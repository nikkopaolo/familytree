"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, Person } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type HistoryPanelProps = {
  events: ChangeEvent[];
  persons: Person[];
};

const findPersonName = (persons: Person[], id?: string) =>
  persons.find((person) => person.id === id)?.fullName ?? "Unknown member";

export const HistoryPanel = ({ events, persons }: HistoryPanelProps) => {
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.targetType !== "position" &&
          (event.action === "create" || event.action === "update" || event.action === "delete")
      ),
    [events]
  );
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const pageEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, page, pageSize]);

  return (
    <section className="glass-card rounded-3xl p-6">
      <h2 className="text-2xl text-slate-900">Audit & Change History</h2>
      <p className="text-sm text-slate-600">
        Only member and relationship changes are listed here.
      </p>
      <div className="mt-6 space-y-4">
        {pageEvents.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            No audited changes yet.
          </div>
        )}
        {pageEvents.map((event) => (
          <div key={event.id} className="surface-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {event.actorName ?? "System"} - {event.action.toUpperCase()}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(event.createdAt)} - {event.targetType} -{" "}
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
      {filteredEvents.length > pageSize && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
