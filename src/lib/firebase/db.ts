import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { ChangeEvent, Clan, Membership, Person, PersonPosition, Relationship } from "../types";
import { getFirebaseDb } from "./client";
import {
  mapChangeEventDoc,
  mapClanDoc,
  mapMembershipDoc,
  mapPersonDoc,
  mapPositionDoc,
  mapRelationshipDoc,
  personToFirestore,
  personUpdateToFirestore,
} from "./mappers";

const clanPersonsRef = (clanId: string) => collection(getFirebaseDb()!, "clans", clanId, "persons");
const clanRelationshipsRef = (clanId: string) =>
  collection(getFirebaseDb()!, "clans", clanId, "relationships");
const clanPositionsRef = (clanId: string) => collection(getFirebaseDb()!, "clans", clanId, "positions");
const clanEventsRef = (clanId: string) => collection(getFirebaseDb()!, "clans", clanId, "changeEvents");

export const fetchAllClans = async (): Promise<Clan[]> => {
  const db = getFirebaseDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, "clans"));
  return snap.docs.map((d) => mapClanDoc(d.id, d.data() as Record<string, unknown>));
};

export const fetchMembershipsForUser = async (userId: string): Promise<Membership[]> => {
  const db = getFirebaseDb();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "memberships"), where("userId", "==", userId)));
  return snap.docs.map((d) => mapMembershipDoc(d.data() as Record<string, unknown>));
};

export const fetchBranchOwnersForUser = async (userId: string) => {
  const db = getFirebaseDb();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "branchOwners"), where("userId", "==", userId)));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return { clanId: String(data.clanId), branchRootId: String(data.branchRootId) };
  });
};

export const fetchClanBundle = async (clanId: string, includeEvents: boolean) => {
  const db = getFirebaseDb();
  if (!db) return { persons: [], relationships: [], positions: [], changeEvents: [] };

  const [personSnap, relSnap, posSnap] = await Promise.all([
    getDocs(clanPersonsRef(clanId)),
    getDocs(clanRelationshipsRef(clanId)),
    getDocs(clanPositionsRef(clanId)),
  ]);

  const persons = personSnap.docs.map((d) => mapPersonDoc(d.id, d.data() as Record<string, unknown>));
  const relationships = relSnap.docs.map((d) =>
    mapRelationshipDoc(d.id, d.data() as Record<string, unknown>)
  );
  const positions = posSnap.docs.map((d) => mapPositionDoc(d.id, d.data() as Record<string, unknown>));

  let changeEvents: ChangeEvent[] = [];
  if (includeEvents) {
    const eventSnap = await getDocs(query(clanEventsRef(clanId), orderBy("createdAt", "desc")));
    changeEvents = eventSnap.docs.map((d) =>
      mapChangeEventDoc(d.id, { ...d.data(), clanId } as Record<string, unknown>)
    );
  }

  return { persons, relationships, positions, changeEvents };
};

export const upsertPerson = async (person: Person) => {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(clanPersonsRef(person.clanId), person.id);
  await setDoc(ref, personToFirestore(person), { merge: true });
  const snap = await getDoc(ref);
  return snap.exists() ? mapPersonDoc(snap.id, snap.data() as Record<string, unknown>) : person;
};

export const updatePerson = async (clanId: string, personId: string, payload: Record<string, unknown>) => {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(clanPersonsRef(clanId), personId);
  await updateDoc(ref, personUpdateToFirestore(payload));
  const snap = await getDoc(ref);
  return snap.exists() ? mapPersonDoc(snap.id, snap.data() as Record<string, unknown>) : null;
};

export const deletePersonTree = async (clanId: string, personId: string) => {
  const db = getFirebaseDb();
  if (!db) return;
  const relSnap = await getDocs(clanRelationshipsRef(clanId));
  const batch = writeBatch(db);
  relSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    if (data.parentId === personId || data.childId === personId) {
      batch.delete(d.ref);
    }
  });
  batch.delete(doc(clanPositionsRef(clanId), personId));
  batch.delete(doc(clanPersonsRef(clanId), personId));
  await batch.commit();
};

export const insertChangeEvent = async (
  clanId: string,
  event: Omit<ChangeEvent, "id" | "clanId"> & { id?: string }
) => {
  const db = getFirebaseDb();
  if (!db) return;
  const id = event.id ?? crypto.randomUUID();
  await setDoc(doc(clanEventsRef(clanId), id), {
    actorId: event.actorId ?? null,
    actorName: event.actorName ?? null,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    action: event.action,
    diff: event.diff,
    createdAt: event.createdAt,
  });
};

export const insertRelationship = async (relationship: Relationship) => {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(clanRelationshipsRef(relationship.clanId), relationship.id);
  await setDoc(ref, {
    clanId: relationship.clanId,
    parentId: relationship.parentId,
    childId: relationship.childId,
    relationshipType: relationship.relationshipType,
    marriageDate: relationship.marriageDate ?? null,
  });
  return relationship;
};

export const updateRelationshipDoc = async (
  clanId: string,
  relationshipId: string,
  payload: Record<string, unknown>
) => {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(clanRelationshipsRef(clanId), relationshipId);
  await updateDoc(ref, payload);
};

export const deleteRelationshipDoc = async (clanId: string, relationshipId: string) => {
  const db = getFirebaseDb();
  if (!db) return;
  await deleteDoc(doc(clanRelationshipsRef(clanId), relationshipId));
};

export const upsertPosition = async (clanId: string, personId: string, x: number, y: number) => {
  const db = getFirebaseDb();
  if (!db) return;
  await setDoc(doc(clanPositionsRef(clanId), personId), { clanId, personId, x, y });
};

export const wipeClanClient = async (clanId: string) => {
  const db = getFirebaseDb();
  if (!db) return;
  const deleteCollection = async (col: ReturnType<typeof collection>) => {
    const snap = await getDocs(col);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length) await batch.commit();
  };
  await deleteCollection(clanRelationshipsRef(clanId));
  await deleteCollection(clanPositionsRef(clanId));
  await deleteCollection(collection(db, "clans", clanId, "suggestions"));
  await deleteCollection(clanEventsRef(clanId));
  await deleteCollection(clanPersonsRef(clanId));
};

export const getFirstClanId = async () => {
  const db = getFirebaseDb();
  if (!db) return "";
  const snap = await getDocs(query(collection(db, "clans"), limit(1)));
  return snap.docs[0]?.id ?? "";
};

export const batchUpsertPersons = async (clanId: string, people: Person[]) => {
  const db = getFirebaseDb();
  if (!db) return;
  const batch = writeBatch(db);
  people.forEach((person) => {
    batch.set(doc(clanPersonsRef(clanId), person.id), personToFirestore(person), { merge: true });
  });
  await batch.commit();
};

export const batchUpsertRelationships = async (clanId: string, rels: Relationship[]) => {
  const db = getFirebaseDb();
  if (!db) return;
  const batch = writeBatch(db);
  rels.forEach((rel) => {
    batch.set(doc(clanRelationshipsRef(clanId), rel.id), {
      clanId: rel.clanId,
      parentId: rel.parentId,
      childId: rel.childId,
      relationshipType: rel.relationshipType,
      marriageDate: rel.marriageDate ?? null,
    });
  });
  await batch.commit();
};
