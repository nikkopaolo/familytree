"use client";

import type { ChangeEvent, Person } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type HistoryPanelProps = {
  events: ChangeEvent[];
  persons: Person[];
};

const findPersonName = (persons: Person[], id?: string) =>
  persons.find((person) => person.id === id)?.fullName ?? "Unknown member";

export const HistoryPanel = ({ events, persons }: HistoryPanelProps) => {
  return (
    <section className="glass-card rounded-3xl p-6">
      <h2 className="text-2xl text-slate-900">Audit & Change History</h2>
      <p className="text-sm text-slate-600">
        Full diff history across members, relationships, and layout moves.
      </p>
      <div className="mt-6 space-y-4">
        {events.map((event) => (
          <div key={event.id} className="surface-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {event.actorName ?? "System"} · {event.action.toUpperCase()}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(event.createdAt)} · {event.targetType} ·{" "}
                  {event.targetType === "person"
                    ? findPersonName(persons, event.targetId)
                    : event.targetId ?? "Unknown"}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {event.diff.length} changes
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {event.diff.map((item) => (
                <div key={item.field} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-700">{item.field}</p>
                  <p className="text-slate-500">Before: {item.before ?? "-"}</p>
                  <p className="text-slate-700">After: {item.after ?? "-"}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
