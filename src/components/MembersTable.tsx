"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Person } from "@/lib/types";
import { calculateAge, formatDate } from "@/lib/utils";

type MembersTableProps = {
  persons: Person[];
  onSelectPerson: (id: string) => void;
  selectedPersonId?: string;
  canDeleteSelected?: boolean;
  canWipe?: boolean;
  onDeletePerson?: (id: string) => void;
  onWipeList?: () => Promise<{ error?: string }> | { error?: string } | void;
};

export const MembersTable = ({
  persons,
  onSelectPerson,
  selectedPersonId,
  canDeleteSelected = false,
  canWipe = false,
  onDeletePerson,
  onWipeList,
}: MembersTableProps) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "alive" | "deceased">("all");

  const handleDeleteSelected = () => {
    if (!selectedPersonId || !onDeletePerson) return;
    const confirmed = window.confirm("Delete selected member? This will remove linked relationships.");
    if (confirmed) {
      onDeletePerson(selectedPersonId);
    }
  };

  const handleWipeList = async () => {
    if (!onWipeList) return;
    const confirmation = window.prompt("Type WIPE to delete all members and relationships.");
    if (confirmation !== "WIPE") return;
    const result = await onWipeList();
    if (result && result.error) {
      window.alert(result.error);
    }
  };

  const filtered = useMemo(() => {
    return persons.filter((person) => {
      const matchesName = person.fullName.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "alive" && person.isAlive) ||
        (filter === "deceased" && !person.isAlive);
      return matchesName && matchesFilter;
    });
  }, [filter, persons, query]);

  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <Search size={18} className="text-slate-400" />
          <input
            className="w-full text-sm text-slate-700 focus:outline-none"
            placeholder="Search by name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          {(["all", "alive", "deceased"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 ${
                filter === value ? "bg-amber-500 text-white" : "bg-white text-slate-600"
              }`}
            >
              {value === "all" ? "All" : value === "alive" ? "Alive" : "Deceased"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleDeleteSelected}
            disabled={!canDeleteSelected || !selectedPersonId}
          >
            Delete selected
          </button>
          <button
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleWipeList}
            disabled={!canWipe}
          >
            Wipe list
          </button>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Birthday</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((person) => (
              <tr
                key={person.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-amber-50/40"
                onClick={() => onSelectPerson(person.id)}
              >
                <td className="px-4 py-4 font-semibold text-slate-800">{person.fullName}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      person.isAlive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {person.isAlive ? "Alive" : "Deceased"}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-600">{formatDate(person.birthDate)}</td>
                <td className="px-4 py-4 text-slate-600">{calculateAge(person.birthDate, person.deathDate)}</td>
                <td className="px-4 py-4 text-slate-600">{person.stats?.location ?? "Unknown"}</td>
                <td className="px-4 py-4 text-slate-500">{person.notes ?? "No notes yet."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
