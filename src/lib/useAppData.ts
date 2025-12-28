"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { diffPerson } from "./diff";
import { initialData } from "./initialData";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type {
  ChangeEvent,
  Clan,
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

  const isSupabaseEnabled = Boolean(isSupabaseConfigured && supabase);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    const storedId = getStoredClanId();
    if (storedId && isUuid(storedId)) {
      setActiveClanId((prev) => (storedId !== prev ? storedId : prev));
    }
  }, [isSupabaseEnabled]);

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
    if (!supabase) return { error: "Supabase not configured." };
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}`
        : process.env.NEXT_PUBLIC_SITE_URL;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    return { error: error?.message };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const bootstrapAdmin = useCallback(async () => {
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
    if (!supabase) return { error: "Supabase not configured." };
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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

    if (!isSupabaseEnabled || !supabase) {
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

    const { data: updatedRow } = await supabase
      .from("persons")
      .update(toPersonUpdateRow(normalizedPayload))
      .eq("id", personId)
      .select()
      .single();

    if (updatedRow) {
      const nextPerson = mapPersonRow(updatedRow);
      setPersons((prev) => prev.map((person) => (person.id === nextPerson.id ? nextPerson : person)));
    }

    await supabase.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: actorLabel,
      target_type: "person",
      target_id: personId,
      action: "update",
      diff,
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

    if (!isSupabaseEnabled || !supabase) {
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
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
      await supabase
        .from("relationships")
        .delete()
        .eq("clan_id", activeClanId)
        .or(`parent_id.eq.${personId},child_id.eq.${personId}`);
      await supabase
        .from("person_positions")
        .delete()
        .eq("clan_id", activeClanId)
        .eq("person_id", personId);
      await supabase.from("persons").delete().eq("id", personId);
    }

    await supabase.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: actorLabel,
      target_type: "person",
      target_id: personId,
      action: "delete",
      diff,
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

    if (!isSupabaseEnabled || !supabase) {
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

    const { data: inserted } = await supabase
      .from("persons")
      .insert({
        id: person.id,
        clan_id: activeClanId,
        branch_root_id: person.branchRootId ?? null,
        full_name: person.fullName,
        birth_date: person.birthDate ?? null,
        death_date: person.deathDate ?? null,
        is_alive: person.isAlive,
        gender: person.gender ?? null,
        photo_url: person.photoUrl ?? null,
        notes: person.notes ?? null,
        stats: person.stats ?? {},
      })
      .select()
      .single();

    const nextPerson = inserted ? mapPersonRow(inserted) : person;
    setPersons((prev) => [nextPerson, ...prev]);
    setSelectedPersonId(nextPerson.id);

    await supabase.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: actorLabel,
      target_type: "person",
      target_id: nextPerson.id,
      action: "create",
      diff: [{ field: "fullName", before: "-", after: nextPerson.fullName }],
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
    relationshipType: "parent" | "partner"
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

    const relationship: Relationship = {
      id: crypto.randomUUID(),
      clanId: activeClanId,
      parentId: personAId,
      childId: personBId,
      relationshipType,
    };

    const changeDiff = isPartner
      ? [
          { field: "partnerA", before: "-", after: personAId },
          { field: "partnerB", before: "-", after: personBId },
        ]
      : [
          { field: "parent", before: "-", after: personAId },
          { field: "child", before: "-", after: personBId },
        ];

    const client = supabase;
    if (!isSupabaseEnabled || !client) {
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

    const { data: inserted } = await client
      .from("relationships")
      .insert({
        id: relationship.id,
        clan_id: activeClanId,
        parent_id: personAId,
        child_id: personBId,
        relationship_type: relationshipType,
      })
      .select()
      .single();

    const nextRel = inserted ? mapRelationshipRow(inserted) : relationship;
    setRelationships((prev) => [nextRel, ...prev]);

    await client.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: actorLabel,
      target_type: "relationship",
      target_id: nextRel.id,
      action: "create",
      diff: changeDiff,
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

  const createPartnerRelationship = async (personId: string, partnerId: string) =>
    createRelationship(personId, partnerId, "partner");

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

    if (!isSupabaseEnabled || !supabase) {
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
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
      await supabase.from("relationships").delete().eq("id", relationshipId);
    }

    await supabase.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: actorLabel,
      target_type: "relationship",
      target_id: relationshipId,
      action: "delete",
      diff,
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

    if (!isSupabaseEnabled || !supabase) {
      setPersons((prev) => prev.filter((person) => person.clanId !== activeClanId));
      setRelationships((prev) => prev.filter((rel) => rel.clanId !== activeClanId));
      setPositions((prev) => prev.filter((pos) => pos.clanId !== activeClanId));
      setChangeEvents((prev) => prev.filter((item) => item.clanId !== activeClanId));
      setSelectedPersonId("");
      return { error: "" };
    }

    let deletedViaAdmin = false;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
      await supabase.from("relationships").delete().eq("clan_id", activeClanId);
      await supabase.from("person_positions").delete().eq("clan_id", activeClanId);
      await supabase.from("suggestions").delete().eq("clan_id", activeClanId);
      await supabase.from("change_events").delete().eq("clan_id", activeClanId);
      await supabase.from("persons").delete().eq("clan_id", activeClanId);
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

    if (!isSupabaseEnabled || !supabase) return;

    await supabase.from("person_positions").upsert({
      person_id: personId,
      clan_id: activeClanId,
      x,
      y,
    });
  };

  const uploadPersonPhoto = async (personId: string, file: File) => {
    if (!isSupabaseEnabled || !supabase) return { error: "Supabase not configured." };
    const ext = file.name.split(".").pop() || "jpg";
    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
    const path = `${activeClanId}/${personId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase
      .storage
      .from("person-photos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { data: publicUrl } = supabase.storage
      .from("person-photos")
      .getPublicUrl(path);

    const photoUrl = publicUrl.publicUrl;

    await applyPersonUpdate(personId, { photoUrl });
    return { error: "" };
  };

  const importPeople = async (rows: Array<Record<string, string>>) => {
    if (isSupabaseEnabled && !isAdmin) {
      return { error: "Sign in as a clan admin to import." };
    }
    let clanId = activeClanId;
    const validClan = clans.find((clan) => clan.id === clanId);
    if (!validClan || !isUuid(clanId)) {
      if (isSupabaseEnabled && supabase) {
        const { data: clanRows } = await supabase.from("clans").select("id").limit(1);
        clanId = clanRows?.[0]?.id ?? "";
        if (clanId) {
          setActiveClanId(clanId);
        }
      }
    }
    if (isSupabaseEnabled && (!clanId || !isUuid(clanId))) {
      return { error: "No valid clan selected for import." };
    }
    const imported = rows.map((row) => {
      const id = crypto.randomUUID();
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
        },
        createdAt: new Date().toISOString(),
      } as Person;
    });

    if (!isSupabaseEnabled || !supabase) {
      setPersons((prev) => [...imported, ...prev]);
      return { error: "" };
    }

    const { data: inserted } = await supabase
      .from("persons")
      .upsert(
        imported.map((person) => ({
          id: person.id,
          clan_id: clanId,
          full_name: person.fullName,
          birth_date: person.birthDate ?? null,
          death_date: person.deathDate ?? null,
          is_alive: person.isAlive,
          gender: person.gender ?? null,
          photo_url: person.photoUrl ?? null,
          notes: person.notes ?? null,
          stats: person.stats ?? {},
        })),
        { onConflict: "id" }
      )
      .select();

    if (inserted) {
      setPersons((prev) => [
        ...inserted.map(mapPersonRow),
        ...prev.filter((person) => person.clanId !== activeClanId),
      ]);
    }
    return { error: "" };
  };

  const importTreeJson = async (payload: { persons: Person[]; relationships: Relationship[] }) => {
    if (isSupabaseEnabled && !isAdmin) {
      return { error: "Sign in as a clan admin to import." };
    }

    let clanId = activeClanId;
    const validClan = clans.find((clan) => clan.id === clanId);
    if (!validClan || !isUuid(clanId)) {
      if (isSupabaseEnabled && supabase) {
        const { data: clanRows } = await supabase.from("clans").select("id").limit(1);
        clanId = clanRows?.[0]?.id ?? "";
        if (clanId) {
          setActiveClanId(clanId);
        }
      }
    }
    if (isSupabaseEnabled && (!clanId || !isUuid(clanId))) {
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
        return {
          id,
          clanId,
          parentId,
          childId,
          relationshipType: rel.relationshipType ?? (rel as any).relationship_type ?? "parent",
        };
      })
      .filter(Boolean) as Relationship[];

    if (!isSupabaseEnabled || !supabase) {
      setPersons((prev) => mergeById(prev, incomingPersons));
      setRelationships((prev) => mergeById(prev, incomingRelationships));
      return { error: "" };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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

    const { data: insertedPersons } = await supabase
      .from("persons")
      .upsert(
        incomingPersons.map((person) => ({
          id: person.id,
          clan_id: clanId,
          branch_root_id: person.branchRootId ?? null,
          full_name: person.fullName,
          birth_date: person.birthDate ?? null,
          death_date: person.deathDate ?? null,
          is_alive: person.isAlive,
          gender: person.gender ?? null,
          photo_url: person.photoUrl ?? null,
          notes: person.notes ?? null,
          stats: person.stats ?? {},
        })),
        { onConflict: "id" }
      )
      .select();

    const { data: insertedRelationships } = await supabase
      .from("relationships")
      .upsert(
        incomingRelationships.map((rel) => ({
          id: rel.id,
          clan_id: clanId,
          parent_id: rel.parentId,
          child_id: rel.childId,
          relationship_type: rel.relationshipType ?? "parent",
        })),
        { onConflict: "id" }
      )
      .select();

    if (insertedPersons) {
      setPersons((prev) => mergeById(prev, insertedPersons.map(mapPersonRow)));
    }

    if (insertedRelationships) {
      setRelationships((prev) => mergeById(prev, insertedRelationships.map(mapRelationshipRow)));
    }
    return { error: "" };
  };

  const loadClans = useCallback(
    async (preferredMemberships: Membership[] = memberships) => {
      const client = supabase;
      if (!isSupabaseEnabled || !client) return;
      const { data: clanRows, error } = await client
        .from("clans")
        .select("id, name, slug, description, is_public");
      if (error) {
        const storedId = getStoredClanId();
        setActiveClanId((prev) =>
          resolveActiveClanId([], preferredMemberships, prev, storedId)
        );
        return;
      }
      if (clanRows && clanRows.length > 0) {
        const mapped = (clanRows ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description ?? undefined,
        }));
        setClans(mapped);
        const storedId = getStoredClanId();
        setActiveClanId((prev) =>
          resolveActiveClanId(mapped, preferredMemberships, prev, storedId)
        );
      }
    },
    [isSupabaseEnabled, memberships]
  );

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseEnabled || !client) return;

    const loadSession = async () => {
      const { data: userData } = await client.auth.getUser();
      const user = userData.user;
      if (!user) {
        setCurrentUser(guestProfile);
        setIsGuest(true);
        setMemberships([]);
        setBranchOwners([]);
        await loadClans([]);
        return;
      }

      setCurrentUser({
        id: user.id,
        name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Member",
        email: user.email ?? "",
      });
      setIsGuest(false);

      await bootstrapAdmin();

      const fetchMemberships = async () => {
        const { data: membershipsRows } = await client
          .from("clan_memberships")
          .select("clan_id, role")
          .eq("user_id", user.id);
        return (membershipsRows ?? []).map((row: any) => ({
          clanId: row.clan_id,
          role: row.role,
        }));
      };

      let membershipsList = await fetchMemberships();
      if (membershipsList.length === 0) {
        await bootstrapAdmin();
        membershipsList = await fetchMemberships();
      }
      setMemberships(membershipsList);
      if (membershipsList.length > 0) {
        setActiveClanId((prev) =>
          isUuid(prev) ? prev : membershipsList[0]?.clanId ?? ""
        );
      }
      await loadClans(membershipsList);

      const { data: ownersRows } = await client
        .from("branch_owners")
        .select("clan_id, branch_root_id")
        .eq("user_id", user.id);
      setBranchOwners(
        (ownersRows ?? []).map((row: any) => ({
          clanId: row.clan_id,
          branchRootId: row.branch_root_id,
        }))
      );
    };

    loadSession();

    const { data: listener } = client.auth.onAuthStateChange(() => {
      loadSession();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [bootstrapAdmin, isSupabaseEnabled, loadClans]);

  useEffect(() => {
    loadClans();
  }, [currentUser.id, loadClans]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    if (isUuid(activeClanId)) return;
    const membershipClanId = memberships[0]?.clanId;
    if (membershipClanId && isUuid(membershipClanId)) {
      setActiveClanId(membershipClanId);
    }
  }, [isSupabaseEnabled, memberships, activeClanId]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseEnabled || !client || !activeClanId) return;
    if (!isUuid(activeClanId)) return;

    const loadClanData = async () => {
      const { data: personRows } = await client
        .from("persons")
        .select("*")
        .eq("clan_id", activeClanId);
      setPersons((personRows ?? []).map(mapPersonRow));

      const { data: relationshipRows } = await client
        .from("relationships")
        .select("*")
        .eq("clan_id", activeClanId);
      setRelationships((relationshipRows ?? []).map(mapRelationshipRow));

      const { data: positionRows } = await client
        .from("person_positions")
        .select("*")
        .eq("clan_id", activeClanId);
      setPositions((positionRows ?? []).map(mapPositionRow));

      if (!isGuest) {
        const { data: eventRows } = await client
          .from("change_events")
          .select("*")
          .eq("clan_id", activeClanId)
          .order("created_at", { ascending: false });
        setChangeEvents((eventRows ?? []).map(mapChangeEventRow));
      } else {
        setChangeEvents([]);
      }
    };

    loadClanData();
    setManualPositions({});
  }, [activeClanId, isGuest, isSupabaseEnabled]);

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
    isSupabaseEnabled,
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
