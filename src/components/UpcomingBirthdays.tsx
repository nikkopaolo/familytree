"use client";

import { useMemo } from "react";
import { addYears, format, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import type { Person } from "@/lib/types";

type UpcomingBirthdaysProps = {
  persons: Person[];
};

export const UpcomingBirthdays = ({ persons }: UpcomingBirthdaysProps) => {
  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    const entries = persons
      .map((person) => {
        if (!person.birthDate) return null;
        const parsed = parseISO(person.birthDate);
        if (!isValid(parsed)) return null;
        const thisYear = new Date(parsed);
        thisYear.setFullYear(today.getFullYear());
        const nextDate = isBefore(thisYear, today) ? addYears(thisYear, 1) : thisYear;
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
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [persons]);

  return (
    <aside className="glass-card rounded-3xl p-6">
      <h3 className="text-xl text-slate-900">Upcoming birthdays</h3>
      <p className="text-sm text-slate-600">The next birthdays across the family.</p>
      {upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No upcoming birthdays yet.</p>
      ) : (
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          {upcoming.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4">
              <span className="font-semibold text-slate-800">{entry.fullName}</span>
              <span className="text-slate-600">
                {format(entry.date, "MMM d")} · Turning {entry.turning}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};
