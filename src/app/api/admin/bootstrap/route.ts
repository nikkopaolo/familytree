import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifyBearerToken } from "@/lib/firebase/admin";
import { getBearerToken, getSuperAdminEmails } from "@/lib/firebase/apiAuth";

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const decoded = await verifyBearerToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Invalid user." }, { status: 401 });
    }

    const superAdmins = getSuperAdminEmails();
    if (!superAdmins.has(email)) {
      return NextResponse.json({ ok: true, promoted: false });
    }

    const db = getAdminDb();
    let clansSnap = await db.collection("clans").get();

    if (clansSnap.empty) {
      const clanRef = db.collection("clans").doc();
      await clanRef.set({
        name: "My Family",
        slug: "my-family",
        description: "Primary clan",
        isPublic: true,
        createdBy: decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      clansSnap = await db.collection("clans").get();
    }

    if (clansSnap.empty) {
      return NextResponse.json({ ok: true, promoted: false, reason: "no_clans" });
    }

    const batch = db.batch();
    clansSnap.docs.forEach((clanDoc) => {
      const membershipRef = db.collection("memberships").doc(`${decoded.uid}_${clanDoc.id}`);
      batch.set(
        membershipRef,
        {
          userId: decoded.uid,
          clanId: clanDoc.id,
          role: "admin",
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();

    return NextResponse.json({ ok: true, promoted: true, clans: clansSnap.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bootstrap failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
