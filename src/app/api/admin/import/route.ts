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

  const personRows = persons.map((person: Record<string, unknown>) => {
    const id = String(person.id ?? crypto.randomUUID());
    const stats = (person.stats ?? {}) as Record<string, unknown>;
    const location = person.location ?? (stats as { location?: string }).location;
    const occupation = person.occupation ?? (stats as { occupation?: string }).occupation;
    const deathDate = person.deathDate ?? person.death_date ?? null;
    const isAlive =
      deathDate ? false : typeof person.isAlive === "boolean" ? person.isAlive : true;

    return {
      id,
      clan_id: clanId,
      branch_root_id: person.branchRootId ?? person.branch_root_id ?? id,
      full_name: person.fullName ?? person.full_name ?? "New Member",
      birth_date: person.birthDate ?? person.birth_date ?? null,
      death_date: deathDate ?? null,
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
      const parentId = rel.parentId ?? rel.parent_id;
      const childId = rel.childId ?? rel.child_id;
      if (!parentId || !childId) return null;
      return {
        id: rel.id ?? crypto.randomUUID(),
        clan_id: clanId,
        parent_id: parentId,
        child_id: childId,
        relationship_type: rel.relationshipType ?? rel.relationship_type ?? "parent",
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
