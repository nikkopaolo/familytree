"use client";

import { useMemo } from "react";
import { addYears, format, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import type { Person, Relationship } from "@/lib/types";

type UpcomingBirthdaysProps = {
  persons: Person[];
  relationships?: Relationship[];
};

export const UpcomingBirthdays = ({ persons, relationships = [] }: UpcomingBirthdaysProps) => {
  const { birthdays, marriageAnniversaries, deathAnniversaries } = useMemo(() => {
    const today = startOfDay(new Date());
    const limit = 6;
    const personById = new Map(persons.map((person) => [person.id, person]));
    const getNextDate = (source: Date) => {
      const candidate = new Date(source);
      candidate.setFullYear(today.getFullYear());
      const normalized = startOfDay(candidate);
      return isBefore(normalized, today) ? addYears(normalized, 1) : normalized;
    };

    const birthdays = persons
      .map((person) => {
        if (!person.birthDate) return null;
        const parsed = parseISO(person.birthDate);
        if (!isValid(parsed)) return null;
        const nextDate = getNextDate(parsed);
        return {
          id: person.id,
          fullName: person.fullName,
          date: nextDate,
          turning: nextDate.getFullYear() - parsed.getFullYear(),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      fullName: string;
      date: Date;
      turning: number;
    }>;

    const deathAnniversaries = persons
      .map((person) => {
        if (!person.deathDate) return null;
        const parsed = parseISO(person.deathDate);
        if (!isValid(parsed)) return null;
        const nextDate = getNextDate(parsed);
        return {
          id: person.id,
          fullName: person.fullName,
          date: nextDate,
          years: nextDate.getFullYear() - parsed.getFullYear(),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      fullName: string;
      date: Date;
      years: number;
    }>;

    const marriageAnniversaries = relationships
      .filter((rel) => rel.relationshipType === "partner" && rel.marriageDate)
      .map((rel) => {
        const parsed = parseISO(rel.marriageDate ?? "");
        if (!isValid(parsed)) return null;
        const nextDate = getNextDate(parsed);
        const partnerA = personById.get(rel.parentId);
        const partnerB = personById.get(rel.childId);
        return {
          id: rel.id,
          label: `${partnerA?.fullName ?? "Unknown member"} & ${partnerB?.fullName ?? "Unknown member"}`,
          date: nextDate,
          years: nextDate.getFullYear() - parsed.getFullYear(),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      label: string;
      date: Date;
      years: number;
    }>;

    return {
      birthdays: birthdays
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, limit),
      deathAnniversaries: deathAnniversaries
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, limit),
      marriageAnniversaries: marriageAnniversaries
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, limit),
    };
  }, [persons, relationships]);

  return (
    <aside className="glass-card rounded-3xl p-6">
      <h3 className="text-xl text-slate-900">Upcoming milestones</h3>
      <p className="text-sm text-slate-600">
        Birthdays plus marriage and memorial anniversaries.
      </p>
      <div className="mt-4 space-y-4 text-sm text-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Birthdays
          </p>
          {birthdays.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No upcoming birthdays yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {birthdays.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-slate-800">
                    {entry.fullName}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {format(entry.date, "MMM d")} - Turning {entry.turning}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Marriage anniversaries
          </p>
          {marriageAnniversaries.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No upcoming anniversaries yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {marriageAnniversaries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-slate-800">
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {format(entry.date, "MMM d")} - {entry.years} years
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Death anniversaries
          </p>
          {deathAnniversaries.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No memorials listed yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {deathAnniversaries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-slate-800">
                    {entry.fullName}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {format(entry.date, "MMM d")} - {entry.years} years
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
};
