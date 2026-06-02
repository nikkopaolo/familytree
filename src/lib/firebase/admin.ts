import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";

const initAdmin = () => {
  if (getApps().length) return;

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const pathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (jsonEnv) {
    initializeApp({ credential: cert(JSON.parse(jsonEnv)) });
    return;
  }

  if (pathEnv && fs.existsSync(pathEnv)) {
    const serviceAccount = JSON.parse(fs.readFileSync(pathEnv, "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
    return;
  }

  throw new Error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS).");
};

export const getAdminDb = () => {
  initAdmin();
  return getFirestore();
};

export const getAdminAuth = () => {
  initAdmin();
  return getAuth();
};

export const verifyBearerToken = async (token: string) => {
  if (!token) return null;
  const auth = getAdminAuth();
  return auth.verifyIdToken(token);
};
