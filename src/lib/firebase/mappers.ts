import type { ChangeEvent, Clan, Membership, Person, PersonPosition, Relationship } from "../types";

export const mapClanDoc = (id: string, data: Record<string, unknown>): Clan => ({
  id,
  name: String(data.name ?? ""),
  slug: String(data.slug ?? ""),
  description: data.description ? String(data.description) : undefined,
});

export const mapPersonDoc = (id: string, data: Record<string, unknown>): Person => ({
  id,
  clanId: String(data.clanId ?? ""),
  branchRootId: String(data.branchRootId ?? id),
  fullName: String(data.fullName ?? ""),
  birthDate: data.birthDate ? String(data.birthDate) : undefined,
  deathDate: data.deathDate ? String(data.deathDate) : undefined,
  isAlive: Boolean(data.isAlive ?? true),
  gender: data.gender ? String(data.gender) : undefined,
  photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
  notes: data.notes ? String(data.notes) : undefined,
  stats: (data.stats as Person["stats"]) ?? {},
  createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
});

export const mapRelationshipDoc = (id: string, data: Record<string, unknown>): Relationship => ({
  id,
  clanId: String(data.clanId ?? ""),
  parentId: String(data.parentId ?? ""),
  childId: String(data.childId ?? ""),
  relationshipType: (data.relationshipType as Relationship["relationshipType"]) ?? "parent",
  marriageDate: data.marriageDate ? String(data.marriageDate) : undefined,
});

export const mapPositionDoc = (personId: string, data: Record<string, unknown>): PersonPosition => ({
  personId,
  clanId: String(data.clanId ?? ""),
  x: Number(data.x ?? 0),
  y: Number(data.y ?? 0),
});

export const mapChangeEventDoc = (id: string, data: Record<string, unknown>): ChangeEvent => ({
  id,
  clanId: String(data.clanId ?? ""),
  actorId: data.actorId ? String(data.actorId) : undefined,
  actorName: data.actorName ? String(data.actorName) : undefined,
  targetType: data.targetType as ChangeEvent["targetType"],
  targetId: data.targetId ? String(data.targetId) : undefined,
  action: data.action as ChangeEvent["action"],
  diff: (data.diff as ChangeEvent["diff"]) ?? [],
  createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
});

export const mapMembershipDoc = (data: Record<string, unknown>): Membership => ({
  clanId: String(data.clanId ?? ""),
  role: (data.role as Membership["role"]) ?? "member",
});

export const personToFirestore = (person: Person) => ({
  clanId: person.clanId,
  branchRootId: person.branchRootId,
  fullName: person.fullName,
  birthDate: person.birthDate ?? null,
  deathDate: person.deathDate ?? null,
  isAlive: person.isAlive,
  gender: person.gender ?? null,
  photoUrl: person.photoUrl ?? null,
  notes: person.notes ?? null,
  stats: person.stats ?? {},
});

export const personUpdateToFirestore = (payload: Record<string, unknown>) => {
  const row: Record<string, unknown> = {};
  if ("fullName" in payload) row.fullName = payload.fullName;
  if ("birthDate" in payload) row.birthDate = payload.birthDate || null;
  if ("deathDate" in payload) row.deathDate = payload.deathDate || null;
  if ("isAlive" in payload) row.isAlive = payload.isAlive;
  if ("gender" in payload) row.gender = payload.gender;
  if ("notes" in payload) row.notes = payload.notes;
  if ("stats" in payload) row.stats = payload.stats;
  if ("photoUrl" in payload) row.photoUrl = payload.photoUrl;
  if ("branchRootId" in payload) row.branchRootId = payload.branchRootId;
  return row;
};
