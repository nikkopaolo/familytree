import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";

const initAdmin = (): App => {
  const existing = getApps()[0];
  if (existing) return existing;

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const pathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (jsonEnv) {
    return initializeApp({ credential: cert(JSON.parse(jsonEnv)) });
  }

  if (pathEnv && fs.existsSync(pathEnv)) {
    const serviceAccount = JSON.parse(fs.readFileSync(pathEnv, "utf8"));
    return initializeApp({ credential: cert(serviceAccount) });
  }

  return initializeApp({ credential: applicationDefault() });
};

export const getAdminDb = () => {
  return getFirestore(initAdmin());
};

export const getAdminAuth = () => {
  return getAuth(initAdmin());
};

export const verifyBearerToken = async (token: string) => {
  if (!token) {
    throw new Error("Missing access token.");
  }
  const auth = getAdminAuth();
  return auth.verifyIdToken(token);
};
