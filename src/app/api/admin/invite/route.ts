import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, verifyBearerToken } from "@/lib/firebase/admin";
import { assertClanAdmin, getBearerToken } from "@/lib/firebase/apiAuth";

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const decoded = await verifyBearerToken(token);
    const requesterEmail = decoded.email ?? "";
    if (!requesterEmail) {
      return NextResponse.json({ error: "Invalid user." }, { status: 401 });
    }

    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const clanId = String(body?.clanId ?? "").trim();
    if (!email || !clanId) {
      return NextResponse.json({ error: "Missing email or clan id." }, { status: 400 });
    }

    const db = getAdminDb();
    const allowed = await assertClanAdmin(db, decoded.uid, requesterEmail, clanId);
    if (!allowed) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const auth = getAdminAuth();
    let invitedUser;
    try {
      invitedUser = await auth.getUserByEmail(email);
    } catch {
      invitedUser = await auth.createUser({ email });
    }

    await db
      .collection("memberships")
      .doc(`${invitedUser.uid}_${clanId}`)
      .set(
        {
          userId: invitedUser.uid,
          clanId,
          role: "admin",
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    const signInLink = await auth.generateSignInWithEmailLink(email, {
      url: process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get("origin") ?? "",
      handleCodeInApp: true,
    });

    return NextResponse.json({ ok: true, signInLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
