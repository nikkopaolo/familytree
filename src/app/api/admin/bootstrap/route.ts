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

  const superAdmins = getSuperAdminEmails();
  if (!superAdmins.has(user.email.toLowerCase())) {
    return NextResponse.json({ ok: true, promoted: false });
  }

  const { data: clans } = await adminClient.from("clans").select("id");
  if (!clans || clans.length === 0) {
    return NextResponse.json({ ok: true, promoted: false, reason: "no_clans" });
  }

  const rows = clans.map((clan) => ({
    clan_id: clan.id,
    user_id: user.id,
    role: "admin",
  }));

  await adminClient.from("clan_memberships").upsert(rows, {
    onConflict: "clan_id,user_id",
  });

  return NextResponse.json({ ok: true, promoted: true, clans: clans.length });
}
