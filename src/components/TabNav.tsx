"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  GitPullRequestArrow,
  MessageSquare,
  Network,
  Share2,
  Users2,
} from "lucide-react";

export type AppTab = "tree" | "compact" | "list" | "stats" | "history" | "suggestions";

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
    id: "compact",
    label: "Compact",
    description: "Focus on close relationships",
    icon: <Share2 size={18} />,
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
  return (
    <div className="mx-auto mt-3 flex w-full max-w-none flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 shadow-sm backdrop-blur">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition md:text-sm ${
            activeTab === tab.id
              ? "border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
              : "border-transparent bg-white/70 text-slate-600 hover:border-amber-200 hover:text-amber-700"
          }`}
        >
          <span className="text-amber-600">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
};
