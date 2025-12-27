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
  const relationshipId = String(body?.relationshipId ?? "").trim();
  if (!clanId || !relationshipId) {
    return NextResponse.json({ error: "Missing clan id or relationship id." }, { status: 400 });
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

  const { error } = await adminClient
    .from("relationships")
    .delete()
    .eq("id", relationshipId)
    .eq("clan_id", clanId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
