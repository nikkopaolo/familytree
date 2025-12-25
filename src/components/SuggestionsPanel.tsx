"use client";

import type { Person, Suggestion } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type SuggestionsPanelProps = {
  suggestions: Suggestion[];
  persons: Person[];
  canApprove: (personId?: string) => boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

const findPersonName = (persons: Person[], id?: string) =>
  persons.find((person) => person.id === id)?.fullName ?? "Unknown member";

export const SuggestionsPanel = ({
  suggestions,
  persons,
  canApprove,
  onApprove,
  onReject,
}: SuggestionsPanelProps) => {
  return (
    <section className="glass-card rounded-3xl p-6">
      <h2 className="text-2xl text-slate-900">Suggestion Queue</h2>
      <p className="text-sm text-slate-600">
        Guests can suggest edits. Admins or branch owners approve changes.
      </p>
      <div className="mt-6 space-y-4">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="surface-card rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {suggestion.action.toUpperCase()} · {suggestion.targetType}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(suggestion.createdAt)} · {findPersonName(persons, suggestion.targetId)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Submitted by {suggestion.creatorEmail ?? "Family member"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  suggestion.status === "pending"
                    ? "bg-amber-100 text-amber-700"
                    : suggestion.status === "approved"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {suggestion.status}
              </span>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-600">Proposed changes</p>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                {JSON.stringify(suggestion.payload, null, 2)}
              </pre>
            </div>
            {suggestion.status === "pending" && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    canApprove(suggestion.targetId)
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                  onClick={() => canApprove(suggestion.targetId) && onApprove(suggestion.id)}
                >
                  Approve
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    canApprove(suggestion.targetId)
                      ? "bg-rose-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                  onClick={() => canApprove(suggestion.targetId) && onReject(suggestion.id)}
                >
                  Reject
                </button>
                {!canApprove(suggestion.targetId) && (
                  <p className="text-xs text-slate-500">
                    Approval restricted to admins or branch owners.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
