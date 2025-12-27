"use client";

import { useEffect, useMemo, useState } from "react";
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
  Suggestion,
  UserProfile,
} from "./types";

type CreateSuggestionInput = {
  clanId: string;
  targetId: string;
  payload: Record<string, unknown>;
  creatorEmail?: string;
};

type BranchOwner = {
  clanId: string;
  branchRootId: string;
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

const mapSuggestionRow = (row: any): Suggestion => ({
  id: row.id,
  clanId: row.clan_id,
  createdAt: row.created_at,
  createdBy: row.created_by ?? undefined,
  creatorEmail: row.creator_email ?? undefined,
  targetType: row.target_type,
  targetId: row.target_id ?? undefined,
  action: row.action,
  payload: row.payload ?? {},
  status: row.status,
  reviewedBy: row.reviewed_by ?? undefined,
  reviewedAt: row.reviewed_at ?? undefined,
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialData.suggestions);
  const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>(initialData.changeEvents);
  const [branchOwners, setBranchOwners] = useState<BranchOwner[]>([]);
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [adminBootstrapError, setAdminBootstrapError] = useState("");

  const isSupabaseEnabled = Boolean(isSupabaseConfigured && supabase);

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

  const clanSuggestions = useMemo(
    () => suggestions.filter((item) => item.clanId === activeClanId),
    [activeClanId, suggestions]
  );

  const clanEvents = useMemo(
    () => changeEvents.filter((item) => item.clanId === activeClanId),
    [activeClanId, changeEvents]
  );

  const canEditPerson = (person: Person) => isAdmin || branchRootIds.has(person.branchRootId);

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

  const bootstrapAdmin = async () => {
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
  };

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
  const createSuggestion = async (input: CreateSuggestionInput) => {
    const normalizedPayload = normalizePersonPayload(input.payload);
    const suggestion: Suggestion = {
      id: crypto.randomUUID(),
      clanId: input.clanId,
      createdAt: new Date().toISOString(),
      creatorEmail: input.creatorEmail,
      targetType: "person",
      targetId: input.targetId,
      action: "update",
      payload: normalizedPayload,
      status: "pending",
    };

    if (!isSupabaseEnabled || !supabase) {
      setSuggestions((prev) => [suggestion, ...prev]);
      return;
    }

    const { data: row, error } = await supabase
      .from("suggestions")
      .insert({
        clan_id: input.clanId,
        created_by: isGuest ? null : currentUser.id,
        creator_email: input.creatorEmail ?? null,
        target_type: "person",
        target_id: input.targetId,
        action: "update",
        payload: normalizedPayload,
        status: "pending",
      })
      .select()
      .single();

    if (!error && row) {
      setSuggestions((prev) => [mapSuggestionRow(row), ...prev]);
      return;
    }

    setSuggestions((prev) => [suggestion, ...prev]);
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
          actorName: currentUser.name,
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
      actor_name: currentUser.name,
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
        actorName: currentUser.name,
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
          actorName: currentUser.name,
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

    await supabase.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: currentUser.name,
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
        actorName: currentUser.name,
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
          actorName: currentUser.name,
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
      actor_name: currentUser.name,
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
        actorName: currentUser.name,
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
          actorName: currentUser.name,
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
      actor_name: currentUser.name,
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
        actorName: currentUser.name,
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

  const approveSuggestion = async (suggestionId: string) => {
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion || suggestion.targetType !== "person" || !suggestion.targetId) {
      return;
    }

    if (isSupabaseEnabled && supabase) {
      await supabase
        .from("suggestions")
        .update({
          status: "approved",
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);
    }

    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === suggestionId
          ? {
              ...item,
              status: "approved",
              reviewedBy: currentUser.id,
              reviewedAt: new Date().toISOString(),
            }
          : item
      )
    );

    await applyPersonUpdate(suggestion.targetId, suggestion.payload);
  };

  const rejectSuggestion = async (suggestionId: string) => {
    if (isSupabaseEnabled && supabase) {
      await supabase
        .from("suggestions")
        .update({
          status: "rejected",
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);
    }

    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === suggestionId
          ? {
              ...item,
              status: "rejected",
              reviewedBy: currentUser.id,
              reviewedAt: new Date().toISOString(),
            }
          : item
      )
    );
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

    await supabase.from("change_events").insert({
      clan_id: activeClanId,
      actor_id: currentUser.id,
      actor_name: currentUser.name,
      target_type: "position",
      target_id: personId,
      action: "update",
      diff: [
        { field: "x", before: "-", after: String(x) },
        { field: "y", before: "-", after: String(y) },
      ],
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
    const imported = rows.map((row) => {
      const id = crypto.randomUUID();
      return {
        id,
        clanId: activeClanId,
        fullName: row.full_name || row.fullName || "New Member",
        birthDate: row.birth_date || undefined,
        deathDate: row.death_date || undefined,
        isAlive: row.is_alive ? row.is_alive.toLowerCase() !== "false" : true,
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
      return;
    }

    const { data: inserted } = await supabase
      .from("persons")
      .insert(
        imported.map((person) => ({
          id: person.id,
          clan_id: activeClanId,
          full_name: person.fullName,
          birth_date: person.birthDate ?? null,
          death_date: person.deathDate ?? null,
          is_alive: person.isAlive,
          gender: person.gender ?? null,
          photo_url: person.photoUrl ?? null,
          notes: person.notes ?? null,
          stats: person.stats ?? {},
        }))
      )
      .select();

    if (inserted) {
      setPersons((prev) => [
        ...inserted.map(mapPersonRow),
        ...prev.filter((person) => person.clanId !== activeClanId),
      ]);
    }
  };

  const importTreeJson = async (payload: { persons: Person[]; relationships: Relationship[] }) => {
    const incomingPersons = (payload.persons ?? []).map((person) => ({
      ...person,
      clanId: activeClanId,
    }));
    const incomingRelationships = (payload.relationships ?? []).map((rel) => ({
      ...rel,
      clanId: activeClanId,
    }));

    if (!isSupabaseEnabled || !supabase) {
      setPersons((prev) => [...incomingPersons, ...prev]);
      setRelationships((prev) => [...incomingRelationships, ...prev]);
      return;
    }

    const { data: insertedPersons } = await supabase
      .from("persons")
      .insert(
        incomingPersons.map((person) => ({
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
        }))
      )
      .select();

    const { data: insertedRelationships } = await supabase
      .from("relationships")
      .insert(
        incomingRelationships.map((rel) => ({
          id: rel.id,
          clan_id: activeClanId,
          parent_id: rel.parentId,
          child_id: rel.childId,
          relationship_type: rel.relationshipType ?? "parent",
        }))
      )
      .select();

    if (insertedPersons) {
      setPersons((prev) => [...insertedPersons.map(mapPersonRow), ...prev]);
    }

    if (insertedRelationships) {
      setRelationships((prev) => [...insertedRelationships.map(mapRelationshipRow), ...prev]);
    }
  };

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
  }, [isSupabaseEnabled]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseEnabled || !client) return;

    const loadClans = async () => {
      const { data: clanRows } = await client
        .from("clans")
        .select("id, name, slug, description, is_public");
      if (clanRows && clanRows.length > 0) {
        const mapped = (clanRows ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description ?? undefined,
        }));
        setClans(mapped);
        setActiveClanId((prev) => mapped.find((clan) => clan.id === prev)?.id ?? mapped[0]?.id ?? "");
      }
    };

    loadClans();
  }, [isSupabaseEnabled]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseEnabled || !client || !activeClanId) return;

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
        const { data: suggestionRows } = await client
          .from("suggestions")
          .select("*")
          .eq("clan_id", activeClanId)
          .order("created_at", { ascending: false });
        setSuggestions((suggestionRows ?? []).map(mapSuggestionRow));

        const { data: eventRows } = await client
          .from("change_events")
          .select("*")
          .eq("clan_id", activeClanId)
          .order("created_at", { ascending: false });
        setChangeEvents((eventRows ?? []).map(mapChangeEventRow));
      } else {
        setSuggestions([]);
        setChangeEvents([]);
      }
    };

    loadClanData();
    setManualPositions({});
  }, [activeClanId, isGuest, isSupabaseEnabled]);

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
    clanSuggestions,
    clanEvents,
    membership,
    isAdmin,
    branchRootIds,
    canEditPerson,
    signInWithEmail,
    signOut,
    inviteAdmin,
    createSuggestion,
    approveSuggestion,
    rejectSuggestion,
    applyPersonUpdate,
    deletePerson,
    createPerson,
    createParentChildRelationship,
    createPartnerRelationship,
    uploadPersonPhoto,
    importPeople,
    importTreeJson,
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
