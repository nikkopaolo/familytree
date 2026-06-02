import type { Firestore } from "firebase-admin/firestore";

export const getSuperAdminEmails = () => {
  const fallback = "katigbaknikkopaolo@gmail.com";
  const raw = process.env.SUPER_ADMIN_EMAILS ?? fallback;
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
};

export const assertClanAdmin = async (
  db: Firestore,
  uid: string,
  email: string,
  clanId: string
) => {
  const superAdmins = getSuperAdminEmails();
  if (superAdmins.has(email.toLowerCase())) return true;

  const membershipRef = db.collection("memberships").doc(`${uid}_${clanId}`);
  const snap = await membershipRef.get();
  return snap.exists && snap.data()?.role === "admin";
};
