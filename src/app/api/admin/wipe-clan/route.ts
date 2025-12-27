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

  const relResult = await adminClient
    .from("relationships")
    .delete()
    .eq("clan_id", clanId);
  if (relResult.error) {
    return NextResponse.json({ error: relResult.error.message }, { status: 400 });
  }

  const positionResult = await adminClient
    .from("person_positions")
    .delete()
    .eq("clan_id", clanId);
  if (positionResult.error) {
    return NextResponse.json({ error: positionResult.error.message }, { status: 400 });
  }

  const suggestionResult = await adminClient
    .from("suggestions")
    .delete()
    .eq("clan_id", clanId);
  if (suggestionResult.error) {
    return NextResponse.json({ error: suggestionResult.error.message }, { status: 400 });
  }

  const changeResult = await adminClient
    .from("change_events")
    .delete()
    .eq("clan_id", clanId);
  if (changeResult.error) {
    return NextResponse.json({ error: changeResult.error.message }, { status: 400 });
  }

  const personResult = await adminClient.from("persons").delete().eq("clan_id", clanId);
  if (personResult.error) {
    return NextResponse.json({ error: personResult.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
