"use client";

import type { ReactNode } from "react";
import { BarChart3, GitPullRequestArrow, MessageSquare, Network, Users2 } from "lucide-react";

export type AppTab = "tree" | "list" | "stats" | "history" | "suggestions";

type TabNavProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  showSuggestions?: boolean;
};

const tabs: Array<{
  id: AppTab;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "tree",
    label: "Tree",
    description: "Visualize and reposition branches",
    icon: <Network size={18} />,
  },
  {
    id: "list",
    label: "List",
    description: "Scan members and manage details",
    icon: <Users2 size={18} />,
  },
  {
    id: "stats",
    label: "Stats",
    description: "Family analytics and charts",
    icon: <BarChart3 size={18} />,
  },
  {
    id: "history",
    label: "History",
    description: "Diffs, approvals, and audits",
    icon: <GitPullRequestArrow size={18} />,
  },
  {
    id: "suggestions",
    label: "Suggestions",
    description: "Guest edits awaiting review",
    icon: <MessageSquare size={18} />,
  },
];

export const TabNav = ({ activeTab, onChange, showSuggestions = true }: TabNavProps) => {
  const visibleTabs = showSuggestions ? tabs : tabs.filter((tab) => tab.id !== "suggestions");
  const gridCols = visibleTabs.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <div className="mx-auto mt-5 w-[min(1320px,94vw)]">
      <div className="rounded-3xl border border-white/70 bg-white/60 p-2 shadow-sm backdrop-blur">
        <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`group rounded-3xl border px-5 py-4 text-left transition ${
                activeTab === tab.id
                  ? "border-amber-300 bg-white shadow-xl shadow-amber-100"
                  : "border-slate-200 bg-white/70 hover:border-amber-200 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  {tab.icon}
                </span>
                {tab.label}
              </div>
              <p className="mt-2 text-xs text-slate-500">{tab.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
