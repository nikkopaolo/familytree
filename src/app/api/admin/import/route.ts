import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getSuperAdminEmails = () => {
  const fallback = "katigbaknikkopaolo@gmail.com";
  const raw = process.env.SUPER_ADMIN_EMAILS ?? fallback;
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
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
  return null;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service role not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.email) {
    return NextResponse.json({ error: "Invalid user." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const clanId = String(body?.clanId ?? "").trim();
  if (!clanId) {
    return NextResponse.json({ error: "Missing clan id." }, { status: 400 });
  }

  const superAdmins = getSuperAdminEmails();
  const isSuperAdmin = superAdmins.has(user.email.toLowerCase());
  if (!isSuperAdmin) {
    const { data: membership } = await adminClient
      .from("clan_memberships")
      .select("role")
      .eq("clan_id", clanId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
  }

  const persons = Array.isArray(body?.persons) ? body.persons : [];
  const relationships = Array.isArray(body?.relationships) ? body.relationships : [];
  const idMap = new Map<string, string>();

  const personRows = persons.map((person: Record<string, unknown>) => {
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
      clan_id: clanId,
      branch_root_id: branchRootId,
      full_name: person.fullName ?? person.full_name ?? "New Member",
      birth_date: birthDate,
      death_date: deathDate,
      is_alive: isAlive,
      gender: person.gender ?? null,
      photo_url: person.photoUrl ?? person.photo_url ?? null,
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
        clan_id: clanId,
        parent_id: parentId,
        child_id: childId,
        relationship_type: rel.relationshipType ?? rel.relationship_type ?? "parent",
        marriage_date: marriageDate,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  for (const batch of chunk(personRows, 200)) {
    const { error } = await adminClient.from("persons").upsert(batch, { onConflict: "id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  for (const batch of chunk(relationshipRows, 400)) {
    const { error } = await adminClient
      .from("relationships")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    ok: true,
    persons: personRows.length,
    relationships: relationshipRows.length,
  });
}
