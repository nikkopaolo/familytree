"use client";

import { Crown, UserPlus2, Wand2 } from "lucide-react";
import type { Clan, MembershipRole, UserProfile } from "@/lib/types";

type TopBarProps = {
  clans: Clan[];
  role?: MembershipRole;
  user: UserProfile;
  onAddMember?: () => void;
  onInviteAdmin?: () => void;
};

const roleLabel = (role?: MembershipRole) => {
  if (!role) return "Viewer";
  return role === "admin" ? "Clan Admin" : "Branch Member";
};

export const TopBar = ({
  clans,
  role,
  user,
  onAddMember,
  onInviteAdmin,
}: TopBarProps) => {
  const activeClanName = clans[0]?.name ?? "Katigbak";
  const clanDisplay = activeClanName.toUpperCase();
  const canManage = role === "admin";
  return (
    <header className="glass-card sticky top-4 z-20 mx-auto mt-4 flex w-[min(1600px,98vw)] flex-col gap-3 rounded-3xl px-6 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl text-slate-900 md:text-3xl">Katigbak Family Tree</h1>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Crown size={14} />
            {roleLabel(role)}
          </span>
        </div>
        <p className="text-xs text-slate-600 md:text-sm">
          Living history and connections for the {clanDisplay} Family.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-300 hover:text-amber-700"
              onClick={onInviteAdmin}
              type="button"
            >
              <UserPlus2 size={16} />
              Invite Admin
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600"
              onClick={onAddMember}
              type="button"
            >
              <Wand2 size={16} />
              Add Member
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
          <div className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500">{user.email ?? "Viewer access"}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
