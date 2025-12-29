"use client";

import { useEffect, useState } from "react";
import { Crown, Palette, UserPlus2, Wand2 } from "lucide-react";
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
  const clanDisplay = activeClanName.trim() || "Katigbak";
  const clanCaption = /family/i.test(clanDisplay)
    ? clanDisplay
    : `${clanDisplay} Family`;
  const canManage = role === "admin";
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("light");
  const [edgeColor, setEdgeColor] = useState("#1f2933");
  const [partnerColor, setPartnerColor] = useState("#f1b34c");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("famtree.themePrefs");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        mode?: "light" | "dark" | "system";
        edgeColor?: string;
        partnerColor?: string;
      };
      if (parsed.mode) setThemeMode(parsed.mode);
      if (parsed.edgeColor) setEdgeColor(parsed.edgeColor);
      if (parsed.partnerColor) setPartnerColor(parsed.partnerColor);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--tree-edge", edgeColor);
    root.style.setProperty("--tree-sibling", edgeColor);
    root.style.setProperty("--tree-partner", partnerColor);
    root.style.setProperty("--accent", partnerColor);

    const applyTheme = (mode: "light" | "dark") => {
      root.setAttribute("data-theme", mode);
    };

    let media: MediaQueryList | null = null;
    let handler: ((event: MediaQueryListEvent) => void) | null = null;
    if (themeMode === "system") {
      media = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(media.matches ? "dark" : "light");
      handler = (event) => applyTheme(event.matches ? "dark" : "light");
      media.addEventListener("change", handler);
    } else {
      applyTheme(themeMode);
    }

    window.localStorage.setItem(
      "famtree.themePrefs",
      JSON.stringify({ mode: themeMode, edgeColor, partnerColor })
    );

    return () => {
      if (media && handler) {
        media.removeEventListener("change", handler);
      }
    };
  }, [edgeColor, partnerColor, themeMode]);

  return (
    <header className="glass-card sticky top-4 z-20 mx-auto mt-4 flex w-full max-w-none flex-col gap-3 rounded-3xl px-6 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl text-slate-900 md:text-3xl">Katigbak Family Tree</h1>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Crown size={14} />
            {roleLabel(role)}
          </span>
        </div>
        <p className="text-xs text-slate-600 md:text-sm">
          Living history and connections for the {clanCaption}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <div className="relative">
          <button
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-300 hover:text-amber-700"
            onClick={() => setThemeOpen((prev) => !prev)}
            type="button"
          >
            <Palette size={16} />
            Theme
          </button>
          {themeOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Mode
                </span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  value={themeMode}
                  onChange={(event) =>
                    setThemeMode(event.target.value as "light" | "dark" | "system")
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </label>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-slate-600">Line color</span>
                <input
                  type="color"
                  value={edgeColor}
                  onChange={(event) => setEdgeColor(event.target.value)}
                  aria-label="Tree line color"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-slate-600">Partner color</span>
                <input
                  type="color"
                  value={partnerColor}
                  onChange={(event) => setPartnerColor(event.target.value)}
                  aria-label="Partner line color"
                />
              </div>
              <button
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600"
                onClick={() => {
                  setThemeMode("light");
                  setEdgeColor("#1f2933");
                  setPartnerColor("#f1b34c");
                }}
                type="button"
              >
                Reset to default
              </button>
            </div>
          )}
        </div>
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
