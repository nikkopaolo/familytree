"use client";

import { useState } from "react";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import type { MembershipRole, UserProfile } from "@/lib/types";

type AuthPanelProps = {
  isFirebaseEnabled: boolean;
  isGuest: boolean;
  currentUser: UserProfile;
  role?: MembershipRole;
  onSignIn: (email: string) => Promise<{ error?: string }>;
  onSignOut: () => Promise<void>;
  adminBootstrapError?: string;
};

export const AuthPanel = ({
  isFirebaseEnabled,
  isGuest,
  currentUser,
  role,
  onSignIn,
  onSignOut,
  adminBootstrapError,
}: AuthPanelProps) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSignIn = async () => {
    if (!email) {
      setMessage("Enter your email to receive a sign-in link.");
      return;
    }
    const result = await onSignIn(email);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Check your inbox for a secure sign-in link.");
      setEmail("");
    }
  };

  if (!isFirebaseEnabled) {
    return (
      <aside className="glass-card rounded-3xl p-6">
        <h3 className="text-xl text-slate-900">Authentication</h3>
        <p className="mt-2 text-sm text-slate-600">
          Firebase is not configured. The app is running in offline mode only.
        </p>
      </aside>
    );
  }

  return (
    <aside className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl text-slate-900">Access Control</h3>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <ShieldCheck size={14} />
          {isGuest
            ? "Viewer"
            : role === "admin"
              ? "Clan Admin"
              : role === "member"
                ? "Member"
                : "Viewer"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {isGuest
          ? "You can browse the tree without signing in. Sign in with an invited email to edit."
          : role
            ? "You can edit members, manage branches, and upload photos."
            : "Signed in, but not invited yet. Ask a clan admin to invite you for editing access."}
      </p>
      <div className="mt-4 space-y-3 text-sm">
        {isGuest ? (
          <>
            <label className="block">
              <span className="text-xs text-slate-500">Email for magic link</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white"
              onClick={handleSignIn}
            >
              <LogIn size={14} />
              Send sign-in link
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{currentUser.name}</p>
              <p className="text-xs text-slate-500">{currentUser.email ?? "Signed in"}</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
              onClick={onSignOut}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
        {message && <p className="text-xs text-slate-500">{message}</p>}
        {adminBootstrapError && (
          <p className="text-xs text-rose-600">{adminBootstrapError}</p>
        )}
      </div>
    </aside>
  );
};
