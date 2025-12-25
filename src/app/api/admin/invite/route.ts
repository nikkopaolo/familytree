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

  const body = await request.json();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const clanId = String(body?.clanId ?? "").trim();
  if (!email || !clanId) {
    return NextResponse.json({ error: "Missing email or clan id." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  const requester = userData?.user;
  if (userError || !requester?.email) {
    return NextResponse.json({ error: "Invalid user." }, { status: 401 });
  }

  const superAdmins = getSuperAdminEmails();
  const isSuperAdmin = superAdmins.has(requester.email.toLowerCase());

  if (!isSuperAdmin) {
    const { data: membership } = await adminClient
      .from("clan_memberships")
      .select("role")
      .eq("clan_id", clanId)
      .eq("user_id", requester.id)
      .maybeSingle();
    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
  }

  const redirectTo = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? undefined;
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined
  );

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const invitedUser = inviteData.user;
  if (!invitedUser) {
    return NextResponse.json({ error: "Invite failed." }, { status: 400 });
  }

  await adminClient.from("clan_memberships").upsert(
    [
      {
        clan_id: clanId,
        user_id: invitedUser.id,
        role: "admin",
      },
    ],
    { onConflict: "clan_id,user_id" }
  );

  return NextResponse.json({ ok: true });
}
