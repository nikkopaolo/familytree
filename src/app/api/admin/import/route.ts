import { NextResponse } from "next/server";
import { getAdminDb, verifyBearerToken } from "@/lib/firebase/admin";
import { assertClanAdmin, getBearerToken } from "@/lib/firebase/apiAuth";

type PersonImportRow = {
  id: string;
  clanId: string;
  branchRootId: string;
  fullName: string;
  birthDate: string | null;
  deathDate: string | null;
  isAlive: boolean;
  gender: unknown;
  photoUrl: unknown;
  notes: unknown;
  stats: Record<string, unknown>;
};

type RelationshipImportRow = {
  id: string;
  clanId: string;
  parentId: string;
  childId: string;
  relationshipType: unknown;
  marriageDate: string | null;
};

const chunk = <T,>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
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

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const decoded = await verifyBearerToken(token);
    const email = decoded.email ?? "";
    if (!email) {
      return NextResponse.json({ error: "Invalid user." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const clanId = String(body?.clanId ?? "").trim();
    if (!clanId) {
      return NextResponse.json({ error: "Missing clan id." }, { status: 400 });
    }

    const db = getAdminDb();
    const allowed = await assertClanAdmin(db, decoded.uid, email, clanId);
    if (!allowed) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const persons = Array.isArray(body?.persons) ? body.persons : [];
    const relationships = Array.isArray(body?.relationships) ? body.relationships : [];
    const idMap = new Map<string, string>();

    const personRows: PersonImportRow[] = persons.map((person: Record<string, unknown>) => {
      const rawId = String(person.id ?? "");
      const id = rawId && isUuid(rawId) ? rawId : crypto.randomUUID();
      if (rawId && rawId !== id) {
        idMap.set(rawId, id);
      }
      const stats = (person.stats ?? {}) as Record<string, unknown>;
      const location = person.location ?? (stats as { location?: string }).location;
      const occupation = person.occupation ?? (stats as { occupation?: string }).occupation;
      const birthDate = normalizeDateInput(person.birthDate ?? person.birth_date);
      const deathDate = normalizeDateInput(person.deathDate ?? person.death_date);
      const isAlive =
        deathDate ? false : typeof person.isAlive === "boolean" ? person.isAlive : true;
      const rawBranch = String(person.branchRootId ?? person.branch_root_id ?? "");
      const branchRootId = rawBranch && isUuid(rawBranch) ? rawBranch : idMap.get(rawBranch) ?? id;

      return {
        id,
        clanId,
        branchRootId,
        fullName: person.fullName ?? person.full_name ?? "New Member",
        birthDate,
        deathDate,
        isAlive,
        gender: person.gender ?? null,
        photoUrl: person.photoUrl ?? person.photo_url ?? null,
        notes: person.notes ?? null,
        stats: {
          ...stats,
          ...(location !== undefined ? { location } : {}),
          ...(occupation !== undefined ? { occupation } : {}),
        },
      };
    });

    const relationshipRows = relationships
      .map((rel: Record<string, unknown>) => {
        const rawParent = rel.parentId ?? rel.parent_id;
        const rawChild = rel.childId ?? rel.child_id;
        if (!rawParent || !rawChild) return null;
        const parentId = idMap.get(String(rawParent)) ?? String(rawParent);
        const childId = idMap.get(String(rawChild)) ?? String(rawChild);
        if (!isUuid(parentId) || !isUuid(childId)) return null;
        const rawId = String(rel.id ?? "");
        const id = rawId && isUuid(rawId) ? rawId : crypto.randomUUID();
        const marriageDate = normalizeDateInput(rel.marriageDate ?? rel.marriage_date);
        return {
          id,
          clanId,
          parentId,
          childId,
          relationshipType: rel.relationshipType ?? rel.relationship_type ?? "parent",
          marriageDate,
        };
      })
      .filter(Boolean) as RelationshipImportRow[];

    for (const batch of chunk(personRows, 200)) {
      const writeBatch = db.batch();
      batch.forEach((person) => {
        writeBatch.set(
          db.collection("clans").doc(clanId).collection("persons").doc(String(person.id)),
          person,
          { merge: true }
        );
      });
      await writeBatch.commit();
    }

    for (const batch of chunk(relationshipRows, 400)) {
      const writeBatch = db.batch();
      batch.forEach((rel) => {
        writeBatch.set(
          db.collection("clans").doc(clanId).collection("relationships").doc(String(rel.id)),
          rel,
          { merge: true }
        );
      });
      await writeBatch.commit();
    }

    return NextResponse.json({
      ok: true,
      persons: personRows.length,
      relationships: relationshipRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
