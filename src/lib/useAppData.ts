"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { diffPerson } from "./diff";
import { initialData } from "./initialData";
import { isFirebaseConfigured } from "./firebase/config";
import {
  completeEmailLinkSignIn,
  getIdToken,
  signInWithEmail as firebaseSignIn,
  signOut as firebaseSignOut,
  subscribeAuth,
} from "./firebase/auth";
import * as firestoreApi from "./firebase/db";
import { uploadPersonPhoto as uploadPhotoToStorage } from "./firebase/storage";
import type {
  ChangeEvent,
  Clan,
  DiffItem,
  Membership,
  Person,
  PersonPosition,
  Relationship,
  UserProfile,
} from "./types";

type BranchOwner = {
  clanId: string;
  branchRootId: string;
};

const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => uuidPattern.test(value);

const normalizeDateInput = (value: unknown) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
};

const guestProfile: UserProfile = {
  id: "guest",
  name: "Guest",
  email: "",
};

const mapPersonRow = (row: any): Person => ({
  id: row.id,
  clanId: row.clan_id,
  branchRootId: row.branch_root_id ?? row.id,
  fullName: row.full_name,
  birthDate: row.birth_date ?? undefined,
  deathDate: row.death_date ?? undefined,
  isAlive: row.is_alive,
  gender: row.gender ?? undefined,
  photoUrl: row.photo_url ?? undefined,
  notes: row.notes ?? undefined,
  stats: row.stats ?? {},
  createdAt: row.created_at ?? new Date().toISOString(),
});

const mapRelationshipRow = (row: any): Relationship => ({
  id: row.id,
  clanId: row.clan_id,
  parentId: row.parent_id,
  childId: row.child_id,
  relationshipType: row.relationship_type ?? "parent",
  marriageDate: row.marriage_date ?? undefined,
});

const mapPositionRow = (row: any): PersonPosition => ({
  personId: row.person_id,
  clanId: row.clan_id,
  x: Number(row.x ?? 0),
  y: Number(row.y ?? 0),
});

const mapChangeEventRow = (row: any): ChangeEvent => ({
  id: row.id,
  clanId: row.clan_id,
  actorId: row.actor_id ?? undefined,
  actorName: row.actor_name ?? undefined,
  targetType: row.target_type,
  targetId: row.target_id ?? undefined,
  action: row.action,
  diff: row.diff ?? [],
  createdAt: row.created_at,
});

const resolveActiveClanId = (
  clansList: Clan[],
  membershipsList: Membership[],
  currentId: string,
  storedId?: string
) => {
  const membershipClanId = membershipsList[0]?.clanId;
  if (membershipClanId && clansList.some((clan) => clan.id === membershipClanId)) {
    return membershipClanId;
  }
  if (storedId && clansList.some((clan) => clan.id === storedId)) {
    return storedId;
  }
  if (currentId && clansList.some((clan) => clan.id === currentId)) {
    return currentId;
  }
  return clansList[0]?.id ?? "";
};

const normalizePersonPayload = (payload: Record<string, unknown>, person?: Person) => {
  if ("location" in payload && !("stats" in payload)) {
    const location = payload.location;
    const rest = { ...payload };
    delete rest.location;
    return {
      ...rest,
      stats: {
        ...(person?.stats ?? {}),
        location,
      },
    };
  }
  return payload;
};

const getStoredClanId = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("famtree.activeClanId") ?? "";
};

const storeClanId = (clanId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("famtree.activeClanId", clanId);
};

const normalizeImportedPerson = (input: Record<string, any>): Person => {
  const stats = (input.stats ?? {}) as Record<string, unknown>;
  const location = input.location ?? (stats as { location?: string }).location;
  const occupation = input.occupation ?? (stats as { occupation?: string }).occupation;
  const birthDate = normalizeDateInput(input.birthDate ?? input.birth_date);
  const deathDate = normalizeDateInput(input.deathDate ?? input.death_date);
  const isAlive =
    deathDate ? false : typeof input.isAlive === "boolean" ? input.isAlive : true;

  return {
    id: input.id ?? crypto.randomUUID(),
    clanId: input.clanId ?? "",
    branchRootId: input.branchRootId ?? input.branch_root_id ?? input.id ?? "",
    fullName: input.fullName ?? input.full_name ?? "New Member",
    birthDate: birthDate ?? undefined,
    deathDate: deathDate ?? undefined,
    isAlive,
    gender: input.gender ?? undefined,
    photoUrl: input.photoUrl ?? input.photo_url ?? undefined,
    notes: input.notes ?? undefined,
    stats: {
      ...stats,
      ...(location !== undefined ? { location } : {}),
      ...(occupation !== undefined ? { occupation } : {}),
    },
    createdAt: input.createdAt ?? input.created_at ?? new Date().toISOString(),
  };
};

const toPersonUpdateRow = (payload: Record<string, unknown>) => {
  const row: Record<string, unknown> = {};
  if ("fullName" in payload) row.full_name = payload.fullName;
  if ("birthDate" in payload) row.birth_date = payload.birthDate || null;
  if ("deathDate" in payload) row.death_date = payload.deathDate || null;
  if ("isAlive" in payload) row.is_alive = payload.isAlive;
  if ("gender" in payload) row.gender = payload.gender;
  if ("notes" in payload) row.notes = payload.notes;
  if ("stats" in payload) row.stats = payload.stats;
  if ("photoUrl" in payload) row.photo_url = payload.photoUrl;
  return row;
};

const toRelationshipUpdateRow = (payload: Record<string, unknown>) => {
  const row: Record<string, unknown> = {};
  if ("marriageDate" in payload) row.marriage_date = payload.marriageDate || null;
  return row;
};

export const useAppData = () => {
  const [clans, setClans] = useState<Clan[]>(initialData.clans);
  const [memberships, setMemberships] = useState<Membership[]>(initialData.memberships);
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialData.currentUser);
  const [isGuest, setIsGuest] = useState(false);
  const [activeClanId, setActiveClanId] = useState<string>(initialData.clans[0]?.id ?? "");
  const [persons, setPersons] = useState<Person[]>(initialData.persons);
  const [relationships, setRelationships] = useState<Relationship[]>(initialData.relationships);
  const [positions, setPositions] = useState<PersonPosition[]>(initialData.positions);
  const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>(initialData.changeEvents);
  const [branchOwners, setBranchOwners] = useState<BranchOwner[]>([]);
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [adminBootstrapError, setAdminBootstrapError] = useState("");

  const isFirebaseEnabled = isFirebaseConfigured;
  const membershipsRef = useRef(memberships);

  useEffect(() => {
    membershipsRef.current = memberships;
  }, [memberships]);

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    const storedId = getStoredClanId();
    if (storedId && isUuid(storedId)) {
      setActiveClanId((prev) => (storedId !== prev ? storedId : prev));
    }
  }, [isFirebaseEnabled]);

  const membership = useMemo(
    () => memberships.find((item) => item.clanId === activeClanId),
    [activeClanId, memberships]
  );

  const isAdmin = membership?.role === "admin";

  const branchRootIds = useMemo(() => {
    const roots = branchOwners
      .filter((owner) => owner.clanId === activeClanId)
      .map((owner) => owner.branchRootId);
    return new Set(roots);
  }, [activeClanId, branchOwners]);

  const clanPersons = useMemo(
    () => persons.filter((person) => person.clanId === activeClanId),
    [activeClanId, persons]
  );

  const clanRelationships = useMemo(
    () => relationships.filter((rel) => rel.clanId === activeClanId),
    [activeClanId, relationships]
  );

  const clanPositions = useMemo(
    () => positions.filter((pos) => pos.clanId === activeClanId),
    [activeClanId, positions]
  );

  const clanEvents = useMemo(
    () => changeEvents.filter((item) => item.clanId === activeClanId),
    [activeClanId, changeEvents]
  );

  const canEditPerson = (person: Person) => isAdmin || branchRootIds.has(person.branchRootId);
  const actorLabel = currentUser.email || currentUser.name || "Member";

  const signInWithEmail = async (email: string) => {
    if (!isFirebaseEnabled) return { error: "Firebase is not configured." };
    return firebaseSignIn(email);
  };

  const signOut = async () => {
    if (!isFirebaseEnabled) return;
    await firebaseSignOut();
  };

  const bootstrapAdmin = useCallback(async () => {
    if (!isFirebaseEnabled) return;
    const token = await getIdToken();
    if (!token) return;
    const response = await fetch("/api/admin/bootstrap", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setAdminBootstrapError(payload.error ?? "Admin bootstrap failed.");
      return;
    }
    setAdminBootstrapError("");
  }, [setAdminBootstrapError]);

  const inviteAdmin = async (email: string, clanId: string) => {
    if (!isFirebaseEnabled) return { error: "Firebase is not configured." };
    const token = await getIdToken();
    if (!token) return { error: "Not signed in." };
    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, clanId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      return { error: payload.error ?? "Invite failed." };
    }
    return { error: "" };
  };
  const applyPersonUpdate = async (personId: string, payload: Record<string, unknown>) => {
    const target = persons.find((person) => person.id === personId);
    if (!target) return;
    const normalizedPayload = normalizePersonPayload(payload, target);
    const updated: Person = { ...target, ...normalizedPayload } as Person;
    const diff = diffPerson(target, updated);

    if (!isFirebaseEnabled) {
      setPersons((prev) => prev.map((person) => (person.id === updated.id ? updated : person)));
      setChangeEvents((prev) => [
        {
          id: crypto.randomUUID(),
          clanId: activeClanId,
          actorId: currentUser.id,
          actorName: actorLabel,
          targetType: "person",
          targetId: updated.id,
          action: "update",
          diff,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      return;
    }

    const nextPerson = await firestoreApi.updatePerson(
      activeClanId,
      personId,
      normalizedPayload
    );
    if (nextPerson) {
      setPersons((prev) => prev.map((person) => (person.id === nextPerson.id ? nextPerson : person)));
    }

    await firestoreApi.insertChangeEvent(activeClanId, {
      actorId: currentUser.id,
      actorName: actorLabel,
      targetType: "person",
      targetId: personId,
      action: "update",
      diff,
      createdAt: new Date().toISOString(),
    });

    setChangeEvents((prev) => [
      {
        id: crypto.randomUUID(),
        clanId: activeClanId,
        actorId: currentUser.id,
        actorName: actorLabel,
        targetType: "person",
        targetId: personId,
        action: "update",
        diff,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const deletePerson = async (personId: string) => {
    const target = persons.find((person) => person.id === personId);
    if (!target) return;
    const updatedRelationships = relationships.filter(
      (rel) => rel.parentId !== personId && rel.childId !== personId
    );
    const updatedPositions = positions.filter((pos) => pos.personId !== personId);

    setPersons((prev) => prev.filter((person) => person.id !== personId));
    setRelationships(updatedRelationships);
    setPositions(updatedPositions);
    setManualPositions((prev) => {
      const { [personId]: _, ...rest } = prev;
      return rest;
    });
    setSelectedPersonId((prev) => (prev === personId ? "" : prev));

    const diff = [{ field: "fullName", before: target.fullName, after: "-" }];

    if (!isFirebaseEnabled) {
      setChangeEvents((prev) => [
        {
          id: crypto.randomUUID(),
          clanId: activeClanId,
          actorId: currentUser.id,
          actorName: actorLabel,
          targetType: "person",
          targetId: personId,
          action: "delete",
          diff,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      return;
    }

    let deletedViaAdmin = false;
    const token = await getIdToken();
    if (token) {
      const response = await fetch("/api/admin/delete-person", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clanId: activeClanId, personId }),
      });
      deletedViaAdmin = response.ok;
    }

    if (!deletedViaAdmin) {
      await firestoreApi.deletePersonTree(activeClanId, personId);
    }

    await firestoreApi.insertChangeEvent(activeClanId, {
      actorId: currentUser.id,
      actorName: actorLabel,
      targetType: "person",
      targetId: personId,
      action: "delete",
      diff,
      createdAt: new Date().toISOString(),
    });

    setChangeEvents((prev) => [
      {
        id: crypto.randomUUID(),
        clanId: activeClanId,
        actorId: currentUser.id,
        actorName: actorLabel,
        targetType: "person",
        targetId: personId,
        action: "delete",
        diff,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const createPerson = async (payload?: Partial<Person>) => {
    const id = crypto.randomUUID();
    const person: Person = {
      id,
      clanId: activeClanId,
      fullName: payload?.fullName ?? "New Member",
      birthDate: payload?.birthDate,
      deathDate: payload?.deathDate,
      isAlive: payload?.isAlive ?? true,
      gender: payload?.gender,
      branchRootId: payload?.branchRootId ?? id,
      photoUrl: payload?.photoUrl,
      notes: payload?.notes,
      stats: payload?.stats ?? {},
      createdAt: new Date().toISOString(),
    };

    if (!isFirebaseEnabled) {
      setPersons((prev) => [person, ...prev]);
      setChangeEvents((prev) => [
        {
          id: crypto.randomUUID(),
          clanId: activeClanId,
          actorId: currentUser.id,
          actorName: actorLabel,
          targetType: "person",
          targetId: person.id,
          action: "create",
          diff: [{ field: "fullName", before: "-", after: person.fullName }],
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSelectedPersonId(person.id);
      return person;
    }

    const nextPerson =
      (await firestoreApi.upsertPerson({ ...person, clanId: activeClanId })) ?? person;
    setPersons((prev) => [nextPerson, ...prev]);
    setSelectedPersonId(nextPerson.id);

    await firestoreApi.insertChangeEvent(activeClanId, {
      actorId: currentUser.id,
      actorName: actorLabel,
      targetType: "person",
      targetId: nextPerson.id,
      action: "create",
      diff: [{ field: "fullName", before: "-", after: nextPerson.fullName }],
      createdAt: new Date().toISOString(),
    });

    setChangeEvents((prev) => [
      {
        id: crypto.randomUUID(),
        clanId: activeClanId,
        actorId: currentUser.id,
        actorName: actorLabel,
        targetType: "person",
        targetId: nextPerson.id,
        action: "create",
        diff: [{ field: "fullName", before: "-", after: nextPerson.fullName }],
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    return nextPerson;
  };

  const createRelationship = async (
    personAId: string,
    personBId: string,
    relationshipType: "parent" | "partner",
    options?: { marriageDate?: string | null }
  ) => {
    if (!personAId || !personBId || personAId === personBId) {
      return undefined;
    }

    const isPartner = relationshipType === "partner";
    const existing = relationships.find((rel) => {
      if (rel.clanId !== activeClanId) return false;
      if (rel.relationshipType !== relationshipType) return false;
      const directMatch = rel.parentId === personAId && rel.childId === personBId;
      if (directMatch) return true;
      if (isPartner) {
        return rel.parentId === personBId && rel.childId === personAId;
      }
      return false;
    });

    if (existing) {
      return existing;
    }

    const normalizedMarriageDate = isPartner
      ? normalizeDateInput(options?.marriageDate)
      : null;

    const relationship: Relationship = {
      id: crypto.randomUUID(),
      clanId: activeClanId,
      parentId: personAId,
      childId: personBId,
      relationshipType,
      ...(normalizedMarriageDate ? { marriageDate: normalizedMarriageDate } : {}),
    };

    const changeDiff = isPartner
      ? [
          { field: "partnerA", before: "-", after: personAId },
          { field: "partnerB", before: "-", after: personBId },
          ...(normalizedMarriageDate
            ? [{ field: "marriageDate", before: "-", after: normalizedMarriageDate }]
            : []),
        ]
      : [
          { field: "parent", before: "-", after: personAId },
          { field: "child", before: "-", after: personBId },
        ];

    if (!isFirebaseEnabled) {
      setRelationships((prev) => [relationship, ...prev]);
      setChangeEvents((prev) => [
        {
          id: crypto.randomUUID(),
          clanId: activeClanId,
          actorId: currentUser.id,
          actorName: actorLabel,
          targetType: "relationship",
          targetId: relationship.id,
          action: "create",
          diff: changeDiff,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      return relationship;
    }

    const nextRel =
      (await firestoreApi.insertRelationship({ ...relationship, clanId: activeClanId })) ??
      relationship;
    setRelationships((prev) => [nextRel, ...prev]);

    await firestoreApi.insertChangeEvent(activeClanId, {
      actorId: currentUser.id,
      actorName: actorLabel,
      targetType: "relationship",
      targetId: nextRel.id,
      action: "create",
      diff: changeDiff,
      createdAt: new Date().toISOString(),
    });

    setChangeEvents((prev) => [
      {
        id: crypto.randomUUID(),
        clanId: activeClanId,
        actorId: currentUser.id,
        actorName: actorLabel,
        targetType: "relationship",
        targetId: nextRel.id,
        action: "create",
        diff: changeDiff,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    return nextRel;
  };

  const createParentChildRelationship = async (parentId: string, childId: string) =>
    createRelationship(parentId, childId, "parent");

  const createPartnerRelationship = async (
    personId: string,
    partnerId: string,
    marriageDate?: string | null
  ) => createRelationship(personId, partnerId, "partner", { marriageDate });

  const updateRelationship = async (
    relationshipId: string,
    payload: Record<string, unknown>
  ) => {
    const target = relationships.find((rel) => rel.id === relationshipId);
    if (!target) return;
    if (target.relationshipType !== "partner") return;
    if (!("marriageDate" in payload)) return;

    const normalizedMarriageDate = "marriageDate" in payload
      ? normalizeDateInput(payload.marriageDate) ?? null
      : null;
    const updated: Relationship = {
      ...target,
      ...("marriageDate" in payload
        ? { marriageDate: normalizedMarriageDate ?? undefined }
        : {}),
    };

    const diff: DiffItem[] = [];
    if ("marriageDate" in payload) {
      diff.push({
        field: "marriageDate",
        before: target.marriageDate ?? "-",
        after: normalizedMarriageDate ?? "-",
      });
    }

    if (!isFirebaseEnabled) {
      setRelationships((prev) =>
        prev.map((rel) => (rel.id === relationshipId ? updated : rel))
      );
      setChangeEvents((prev) => [
        {
          id: crypto.randomUUID(),
          clanId: activeClanId,
          actorId: currentUser.id,
          actorName: actorLabel,
          targetType: "relationship",
          targetId: relationshipId,
          action: "update",
          diff,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      return;
    }

    await firestoreApi.updateRelationshipDoc(activeClanId, relationshipId, {
      marriageDate: normalizedMarriageDate,
    });
    setRelationships((prev) =>
      prev.map((rel) => (rel.id === relationshipId ? updated : rel))
    );

    await firestoreApi.insertChangeEvent(activeClanId, {
      actorId: currentUser.id,
      actorName: actorLabel,
      targetType: "relationship",
      targetId: relationshipId,
      action: "update",
      diff,
      createdAt: new Date().toISOString(),
    });

    setChangeEvents((prev) => [
      {
        id: crypto.randomUUID(),
        clanId: activeClanId,
        actorId: currentUser.id,
        actorName: actorLabel,
        targetType: "relationship",
        targetId: relationshipId,
        action: "update",
        diff,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const deleteRelationship = async (relationshipId: string) => {
    const target = relationships.find((rel) => rel.id === relationshipId);
    if (!target) return;

    setRelationships((prev) => prev.filter((rel) => rel.id !== relationshipId));

    const diff = [
      {
        field: target.relationshipType,
        before: `${target.parentId}:${target.childId}`,
        after: "-",
      },
    ];

    if (!isFirebaseEnabled) {
      setChangeEvents((prev) => [
        {
          id: crypto.randomUUID(),
          clanId: activeClanId,
          actorId: currentUser.id,
          actorName: actorLabel,
          targetType: "relationship",
          targetId: relationshipId,
          action: "delete",
          diff,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      return;
    }

    let deletedViaAdmin = false;
    const token = await getIdToken();
    if (token) {
      const response = await fetch("/api/admin/delete-relationship", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clanId: activeClanId, relationshipId }),
      });
      deletedViaAdmin = response.ok;
    }

    if (!deletedViaAdmin) {
      await firestoreApi.deleteRelationshipDoc(activeClanId, relationshipId);
    }

    await firestoreApi.insertChangeEvent(activeClanId, {
      actorId: currentUser.id,
      actorName: actorLabel,
      targetType: "relationship",
      targetId: relationshipId,
      action: "delete",
      diff,
      createdAt: new Date().toISOString(),
    });

    setChangeEvents((prev) => [
      {
        id: crypto.randomUUID(),
        clanId: activeClanId,
        actorId: currentUser.id,
        actorName: actorLabel,
        targetType: "relationship",
        targetId: relationshipId,
        action: "delete",
        diff,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const wipeClanData = async () => {
    if (!activeClanId) return { error: "Missing clan." };

    if (!isFirebaseEnabled) {
      setPersons((prev) => prev.filter((person) => person.clanId !== activeClanId));
      setRelationships((prev) => prev.filter((rel) => rel.clanId !== activeClanId));
      setPositions((prev) => prev.filter((pos) => pos.clanId !== activeClanId));
      setChangeEvents((prev) => prev.filter((item) => item.clanId !== activeClanId));
      setSelectedPersonId("");
      return { error: "" };
    }

    let deletedViaAdmin = false;
    const token = await getIdToken();
    if (token) {
      const response = await fetch("/api/admin/wipe-clan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clanId: activeClanId }),
      });
      deletedViaAdmin = response.ok;
    }

    if (!deletedViaAdmin) {
      await firestoreApi.wipeClanClient(activeClanId);
    }

    setPersons((prev) => prev.filter((person) => person.clanId !== activeClanId));
    setRelationships((prev) => prev.filter((rel) => rel.clanId !== activeClanId));
    setPositions((prev) => prev.filter((pos) => pos.clanId !== activeClanId));
    setChangeEvents((prev) => prev.filter((item) => item.clanId !== activeClanId));
    setSelectedPersonId("");
    return { error: "" };
  };

  const updateManualPosition = async (personId: string, x: number, y: number) => {
    setManualPositions((prev) => ({
      ...prev,
      [personId]: { x, y },
    }));

    if (!isFirebaseEnabled) return;

    await firestoreApi.upsertPosition(activeClanId, personId, x, y);
  };

  const uploadPersonPhoto = async (personId: string, file: File) => {
    if (!isFirebaseEnabled) return { error: "Firebase is not configured." };
    const { error, url } = await uploadPhotoToStorage(activeClanId, personId, file);
    if (error) return { error };
    await applyPersonUpdate(personId, { photoUrl: url });
    return { error: "" };
  };

    const importPeople = async (rows: Array<Record<string, string>>) => {
      if (isFirebaseEnabled && !isAdmin) {
        return { error: "Sign in as a clan admin to import." };
      }
      let clanId = activeClanId;
    const validClan = clans.find((clan) => clan.id === clanId);
    if (!validClan || !isUuid(clanId)) {
      if (isFirebaseEnabled) {
        clanId = await firestoreApi.getFirstClanId();
        if (clanId) {
          setActiveClanId(clanId);
        }
      }
    }
      if (isFirebaseEnabled && (!clanId || !isUuid(clanId))) {
        return { error: "No valid clan selected for import." };
      }
      const normalizeNameKey = (value: string) => value.trim().toLowerCase();
      const splitListValue = (value?: string) => {
        if (!value) return [];
        return value
          .split(/\s*\|\s*|\s*;\s*|\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean);
      };
      const getRowValue = (row: Record<string, string>, keys: string[]) => {
        for (const key of keys) {
          const value = row[key];
          if (value && value.trim()) return value;
        }
        return "";
      };
      const buildUniqueNameMap = (people: Person[]) => {
        const map = new Map<string, string[]>();
        people.forEach((person) => {
          const key = normalizeNameKey(person.fullName || "");
          if (!key) return;
          const list = map.get(key) ?? [];
          list.push(person.id);
          map.set(key, list);
        });
        const resolved = new Map<string, string>();
        map.forEach((ids, key) => {
          if (ids.length === 1) {
            resolved.set(key, ids[0]);
          }
        });
        return resolved;
      };
      const parsePartnerEntry = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const match = trimmed.match(/^(.*)\(([^)]+)\)\s*$/);
        if (match) {
          const name = match[1].trim();
          const dateValue = normalizeDateInput(match[2].trim()) ?? undefined;
          return { name, dateValue };
        }
        return { name: trimmed, dateValue: undefined };
      };

      const usedIds = new Set<string>();
      const resolveRowId = (rawValue?: string) => {
        const trimmed = rawValue?.trim() ?? "";
        if (trimmed && isUuid(trimmed) && !usedIds.has(trimmed)) {
          usedIds.add(trimmed);
          return trimmed;
        }
        let nextId = crypto.randomUUID();
        while (usedIds.has(nextId)) {
          nextId = crypto.randomUUID();
        }
        usedIds.add(nextId);
        return nextId;
      };

      const imported = rows.map((row) => {
        const rawId = row.id || row.person_id || row.personId || "";
        const id = resolveRowId(rawId);
        const birthDate = normalizeDateInput(row.birth_date || row.birthDate) ?? undefined;
        const deathDate = normalizeDateInput(row.death_date || row.deathDate) ?? undefined;
        const isAlive = row.is_alive
          ? row.is_alive.toLowerCase() !== "false"
          : !deathDate;
        return {
          id,
          clanId,
          fullName: row.full_name || row.fullName || "New Member",
          birthDate,
          deathDate,
          isAlive,
          gender: row.gender || undefined,
          branchRootId: id,
          photoUrl: row.photo_url || row.photoUrl || undefined,
          notes: row.notes || undefined,
          stats: {
            location: row.location || undefined,
            occupation: row.occupation || undefined,
          },
          createdAt: new Date().toISOString(),
        } as Person;
      });

      const existingClanPersons = persons.filter((person) => person.clanId === clanId);
      const importedNameMap = buildUniqueNameMap(imported);
      const existingNameMap = buildUniqueNameMap(existingClanPersons);
      const idLookup = new Set([
        ...imported.map((person) => person.id),
        ...existingClanPersons.map((person) => person.id),
      ]);

      const resolvePersonId = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (isUuid(trimmed)) {
          return idLookup.has(trimmed) ? trimmed : null;
        }
        const key = normalizeNameKey(trimmed);
        return importedNameMap.get(key) ?? existingNameMap.get(key) ?? null;
      };

      const existingParentKeys = new Set(
        relationships
          .filter(
            (rel) =>
              rel.relationshipType === "parent" && rel.clanId === clanId
          )
          .map((rel) => `${rel.parentId}|${rel.childId}`)
      );
      const normalizePair = (left: string, right: string) =>
        left < right ? `${left}|${right}` : `${right}|${left}`;
      const existingPartnerKeys = new Set(
        relationships
          .filter(
            (rel) =>
              rel.relationshipType === "partner" && rel.clanId === clanId
          )
          .map((rel) => normalizePair(rel.parentId, rel.childId))
      );
      const partnerIndexByKey = new Map<string, number>();
      const importedRelationships: Relationship[] = [];

      const addParentRelationship = (parentId: string, childId: string) => {
        if (!parentId || !childId || parentId === childId) return;
        const key = `${parentId}|${childId}`;
        if (existingParentKeys.has(key)) return;
        existingParentKeys.add(key);
        importedRelationships.push({
          id: crypto.randomUUID(),
          clanId,
          parentId,
          childId,
          relationshipType: "parent",
        });
      };

      const addPartnerRelationship = (
        firstId: string,
        secondId: string,
        marriageDate?: string
      ) => {
        if (!firstId || !secondId || firstId === secondId) return;
        const key = normalizePair(firstId, secondId);
        const existingIndex = partnerIndexByKey.get(key);
        if (existingIndex !== undefined) {
          if (marriageDate && !importedRelationships[existingIndex].marriageDate) {
            importedRelationships[existingIndex].marriageDate = marriageDate;
          }
          return;
        }
        if (existingPartnerKeys.has(key)) return;
        const relationship: Relationship = {
          id: crypto.randomUUID(),
          clanId,
          parentId: firstId,
          childId: secondId,
          relationshipType: "partner",
          ...(marriageDate ? { marriageDate } : {}),
        };
        existingPartnerKeys.add(key);
        partnerIndexByKey.set(key, importedRelationships.length);
        importedRelationships.push(relationship);
      };

      rows.forEach((row, index) => {
        const person = imported[index];
        if (!person) return;
        const parentTokens = splitListValue(
          getRowValue(row, ["parents", "parent", "parent_names", "parent_name"])
        );
        const childTokens = splitListValue(
          getRowValue(row, ["children", "child", "child_names", "child_name"])
        );
        const partnerTokens = splitListValue(
          getRowValue(row, ["partners", "partner", "partner_names", "partner_name"])
        );
        const marriageTokens = splitListValue(
          getRowValue(row, [
            "partner_marriages",
            "partner_marriage",
            "partner_marriage_dates",
            "partner_marriages_dates",
            "partnerMarriage",
          ])
        );

        parentTokens.forEach((entry) => {
          const parentId = resolvePersonId(entry);
          if (parentId) addParentRelationship(parentId, person.id);
        });

        childTokens.forEach((entry) => {
          const childId = resolvePersonId(entry);
          if (childId) addParentRelationship(person.id, childId);
        });

        const partnerEntries = [
          ...partnerTokens.map((value) => ({ name: value, dateValue: undefined })),
          ...marriageTokens.map((value) => parsePartnerEntry(value)).filter(Boolean),
        ] as Array<{ name: string; dateValue?: string }>;

        partnerEntries.forEach((entry) => {
          const partnerId = resolvePersonId(entry.name);
          if (!partnerId) return;
          addPartnerRelationship(person.id, partnerId, entry.dateValue);
        });
      });

      if (!isFirebaseEnabled) {
        setPersons((prev) => [...imported, ...prev]);
        if (importedRelationships.length > 0) {
          setRelationships((prev) => [...importedRelationships, ...prev]);
        }
        return { error: "" };
      }

      await firestoreApi.batchUpsertPersons(clanId, imported);
      setPersons((prev) => [
        ...imported,
        ...prev.filter((person) => person.clanId !== activeClanId),
      ]);
      if (importedRelationships.length > 0) {
        await firestoreApi.batchUpsertRelationships(clanId, importedRelationships);
        setRelationships((prev) => [
          ...importedRelationships,
          ...prev.filter((rel) => rel.clanId !== activeClanId),
        ]);
      }
      return { error: "" };
    };

  const importTreeJson = async (payload: { persons: Person[]; relationships: Relationship[] }) => {
    if (isFirebaseEnabled && !isAdmin) {
      return { error: "Sign in as a clan admin to import." };
    }

    let clanId = activeClanId;
    const validClan = clans.find((clan) => clan.id === clanId);
    if (!validClan || !isUuid(clanId)) {
      if (isFirebaseEnabled) {
        clanId = await firestoreApi.getFirstClanId();
        if (clanId) {
          setActiveClanId(clanId);
        }
      }
    }
    if (isFirebaseEnabled && (!clanId || !isUuid(clanId))) {
      return { error: "No valid clan selected for import." };
    }

    const idMap = new Map<string, string>();
    const incomingPersons = (payload.persons ?? []).map((person) => {
      const normalized = normalizeImportedPerson(person as Record<string, unknown>);
      const rawId = String(normalized.id ?? "");
      const id = isUuid(rawId) ? rawId : crypto.randomUUID();
      if (rawId && rawId !== id) {
        idMap.set(rawId, id);
      }
      const rawBranch = String(normalized.branchRootId ?? "");
      const branchRootId = isUuid(rawBranch)
        ? rawBranch
        : idMap.get(rawBranch) ?? id;
      return {
        ...normalized,
        id,
        clanId,
        branchRootId: branchRootId || id,
      };
    });
    const incomingRelationships = (payload.relationships ?? [])
      .map((rel) => {
        const rawParent = rel.parentId ?? (rel as any).parent_id;
        const rawChild = rel.childId ?? (rel as any).child_id;
        if (!rawParent || !rawChild) return null;
        const parentId = idMap.get(String(rawParent)) ?? String(rawParent);
        const childId = idMap.get(String(rawChild)) ?? String(rawChild);
        if (!isUuid(parentId) || !isUuid(childId)) return null;
        const rawId = String(rel.id ?? "");
        const id = rawId && isUuid(rawId) ? rawId : crypto.randomUUID();
        const marriageDate = normalizeDateInput(
          (rel as any).marriageDate ?? (rel as any).marriage_date
        );
        return {
          id,
          clanId,
          parentId,
          childId,
          relationshipType: rel.relationshipType ?? (rel as any).relationship_type ?? "parent",
          ...(marriageDate ? { marriageDate } : {}),
        };
      })
      .filter(Boolean) as Relationship[];

    if (!isFirebaseEnabled) {
      setPersons((prev) => mergeById(prev, incomingPersons));
      setRelationships((prev) => mergeById(prev, incomingRelationships));
      return { error: "" };
    }

    const token = await getIdToken();
    if (token) {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clanId,
          persons: incomingPersons,
          relationships: incomingRelationships,
        }),
      });
      if (response.ok) {
        setPersons((prev) => mergeById(prev, incomingPersons));
        setRelationships((prev) => mergeById(prev, incomingRelationships));
        return { error: "" };
      }
      const payload = await response.json().catch(() => ({}));
      return { error: payload.error ?? "Import failed. Check the data format." };
    }

    await firestoreApi.batchUpsertPersons(clanId, incomingPersons);
    await firestoreApi.batchUpsertRelationships(clanId, incomingRelationships);
    setPersons((prev) => mergeById(prev, incomingPersons));
    setRelationships((prev) => mergeById(prev, incomingRelationships));
    return { error: "" };
  };

  const loadClans = useCallback(
    async (preferredMemberships?: Membership[]) => {
      if (!isFirebaseEnabled) return;
      const mapped = await firestoreApi.fetchAllClans();
      if (mapped.length > 0) {
        setClans(mapped);
        const storedId = getStoredClanId();
        const membershipList = preferredMemberships ?? membershipsRef.current;
        setActiveClanId((prev) =>
          resolveActiveClanId(mapped, membershipList, prev, storedId)
        );
      }
    },
    [isFirebaseEnabled]
  );

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    void completeEmailLinkSignIn();
  }, [isFirebaseEnabled]);

  useEffect(() => {
    if (!isFirebaseEnabled) return;

    const loadSession = async (user: import("firebase/auth").User | null) => {
      if (!user) {
        setCurrentUser(guestProfile);
        setIsGuest(true);
        setMemberships([]);
        setBranchOwners([]);
        await loadClans([]);
        return;
      }

      setCurrentUser({
        id: user.uid,
        name: user.displayName ?? user.email?.split("@")[0] ?? "Member",
        email: user.email ?? "",
      });
      setIsGuest(false);

      await bootstrapAdmin();

      let membershipsList = await firestoreApi.fetchMembershipsForUser(user.uid);
      if (membershipsList.length === 0) {
        await bootstrapAdmin();
        membershipsList = await firestoreApi.fetchMembershipsForUser(user.uid);
      }
      setMemberships(membershipsList);
      if (membershipsList.length > 0) {
        setActiveClanId((prev) =>
          isUuid(prev) ? prev : membershipsList[0]?.clanId ?? ""
        );
      }
      await loadClans(membershipsList);
      setBranchOwners(await firestoreApi.fetchBranchOwnersForUser(user.uid));
    };

    const unsubscribe = subscribeAuth((user) => {
      void loadSession(user);
    });

    return () => unsubscribe?.();
  }, [bootstrapAdmin, isFirebaseEnabled, loadClans]);

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    if (isUuid(activeClanId)) return;
    const membershipClanId = memberships[0]?.clanId;
    if (membershipClanId && isUuid(membershipClanId)) {
      setActiveClanId(membershipClanId);
    }
  }, [isFirebaseEnabled, memberships, activeClanId]);

  useEffect(() => {
    if (!isFirebaseEnabled || !activeClanId) return;
    if (!isUuid(activeClanId)) return;

    const loadClanData = async () => {
      const bundle = await firestoreApi.fetchClanBundle(activeClanId, !isGuest);
      setPersons(bundle.persons);
      setRelationships(bundle.relationships);
      setPositions(bundle.positions);
      setChangeEvents(bundle.changeEvents);
    };

    void loadClanData();
    setManualPositions({});
  }, [activeClanId, isGuest, isFirebaseEnabled]);

  useEffect(() => {
    if (activeClanId) {
      storeClanId(activeClanId);
    }
  }, [activeClanId]);

  useEffect(() => {
    if (!selectedPersonId && clanPersons.length > 0) {
      setSelectedPersonId(clanPersons[0]?.id ?? "");
    }
  }, [clanPersons, selectedPersonId]);

  return {
    clans,
    memberships,
    currentUser,
    isGuest,
    isFirebaseEnabled,
    activeClanId,
    setActiveClanId,
    clanPersons,
    clanRelationships,
    clanPositions,
    clanEvents,
    membership,
    isAdmin,
    branchRootIds,
    canEditPerson,
    signInWithEmail,
    signOut,
    inviteAdmin,
    applyPersonUpdate,
    deletePerson,
    createPerson,
    createParentChildRelationship,
    createPartnerRelationship,
    updateRelationship,
    deleteRelationship,
    uploadPersonPhoto,
    importPeople,
    importTreeJson,
    wipeClanData,
    manualPositions,
    updateManualPosition,
    selectedPersonId,
    setSelectedPersonId,
    persons,
    relationships,
    positions,
    adminBootstrapError,
  };
};
