import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb, verifyBearerToken } from "@/lib/firebase/admin";
import { assertClanAdmin, getBearerToken } from "@/lib/firebase/apiAuth";

const deleteSubcollection = async (
  db: Firestore,
  clanId: string,
  name: string
) => {
  const snap = await db.collection("clans").doc(clanId).collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
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

    await deleteSubcollection(db, clanId, "relationships");
    await deleteSubcollection(db, clanId, "positions");
    await deleteSubcollection(db, clanId, "suggestions");
    await deleteSubcollection(db, clanId, "changeEvents");
    await deleteSubcollection(db, clanId, "persons");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wipe failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
