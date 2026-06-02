import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { siteUrl } from "./config";
import { getFirebaseAuth } from "./client";

const EMAIL_KEY = "famtree.emailForSignIn";

export const completeEmailLinkSignIn = async () => {
  const auth = getFirebaseAuth();
  if (!auth || typeof window === "undefined") return;
  if (!isSignInWithEmailLink(auth, window.location.href)) return;

  let email = window.localStorage.getItem(EMAIL_KEY) ?? "";
  if (!email) {
    email = window.prompt("Enter the email you used to sign in.") ?? "";
  }
  if (!email) return;
  await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(EMAIL_KEY);
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, document.title, url.toString());
};

export const signInWithEmail = async (email: string) => {
  const auth = getFirebaseAuth();
  if (!auth) return { error: "Firebase is not configured." };
  const redirectUrl = typeof window !== "undefined" ? window.location.origin : siteUrl;
  if (!redirectUrl) return { error: "Site URL is not configured." };

  const actionCodeSettings = {
    url: redirectUrl,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EMAIL_KEY, email);
    }
    return { error: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed.";
    if (message.includes("auth/configuration-not-found")) {
      return {
        error:
          "Firebase Auth is not enabled for email-link sign-in. Enable Authentication > Sign-in method > Email/Password, then turn on Email link.",
      };
    }
    return { error: message };
  }
};

export const signOut = async () => {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await firebaseSignOut(auth);
};

export const getIdToken = async () => {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return "";
  return user.getIdToken();
};

export const subscribeAuth = (callback: (user: User | null) => void) => {
  const auth = getFirebaseAuth();
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, callback);
};
