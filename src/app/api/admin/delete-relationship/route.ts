import { NextResponse } from "next/server";
import { getAdminDb, verifyBearerToken } from "@/lib/firebase/admin";
import { assertClanAdmin, getBearerToken } from "@/lib/firebase/apiAuth";

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
    const relationshipId = String(body?.relationshipId ?? "").trim();
    if (!clanId || !relationshipId) {
      return NextResponse.json({ error: "Missing clan id or relationship id." }, { status: 400 });
    }

    const db = getAdminDb();
    const allowed = await assertClanAdmin(db, decoded.uid, email, clanId);
    if (!allowed) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    await db
      .collection("clans")
      .doc(clanId)
      .collection("relationships")
      .doc(relationshipId)
      .delete();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
