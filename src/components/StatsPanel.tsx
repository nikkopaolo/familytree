"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Person, Relationship } from "@/lib/types";
import { calculateAge, parseDateValue } from "@/lib/utils";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

type StatsPanelProps = {
  persons: Person[];
  relationships?: Relationship[];
  forcedMonth?: number | null;
  onMonthChange?: (month: number | null) => void;
};

const ageBuckets = [
  { label: "0-19", min: 0, max: 19 },
  { label: "20-39", min: 20, max: 39 },
  { label: "40-59", min: 40, max: 59 },
  { label: "60+", min: 60, max: 150 },
];

const toNumberOrNull = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const medianValue = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

type CalendarEvent = {
  id: string;
  date: Date;
  label: string;
  type: "birthday" | "death" | "marriage";
  years: number;
};

const milestoneMeta = {
  birthday: { label: "Birthday", dot: "bg-amber-400", text: "text-amber-600" },
  death: { label: "Memorial", dot: "bg-rose-400", text: "text-rose-600" },
  marriage: { label: "Anniversary", dot: "bg-emerald-400", text: "text-emerald-600" },
} as const;

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const StatsPanel = ({
  persons,
  relationships = [],
  forcedMonth,
  onMonthChange,
}: StatsPanelProps) => {
  const aliveCount = persons.filter((person) => person.isAlive).length;
  const deceasedCount = persons.length - aliveCount;
  const [selectedMonth, setSelectedMonth] = useState<number | null>(forcedMonth ?? null);
  const [selectedStatus, setSelectedStatus] = useState<"alive" | "deceased" | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [familyPage, setFamilyPage] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [calendarDay, setCalendarDay] = useState<Date | null>(() => startOfDay(new Date()));
  const familyPageSize = 5;
  const personById = useMemo(
    () => new Map(persons.map((person) => [person.id, person])),
    [persons]
  );

  const aliveBreakdown = [
    { name: "Alive", value: aliveCount },
    { name: "Deceased", value: deceasedCount },
  ];

  useEffect(() => {
    if (forcedMonth === undefined) return;
    setSelectedMonth(forcedMonth);
    if (forcedMonth === null) return;
    const nextMonth = new Date();
    nextMonth.setMonth(forcedMonth);
    setCalendarMonth(startOfMonth(nextMonth));
  }, [forcedMonth]);

  useEffect(() => {
    if (!calendarDay || !isSameMonth(calendarDay, calendarMonth)) {
      setCalendarDay(startOfMonth(calendarMonth));
    }
  }, [calendarDay, calendarMonth]);

  const handleMonthSelect = (month: number | null) => {
    setSelectedMonth(month);
    onMonthChange?.(month);
  };

  const handleCalendarShift = (direction: "prev" | "next") => {
    const nextMonth =
      direction === "next" ? addMonths(calendarMonth, 1) : subMonths(calendarMonth, 1);
    setCalendarMonth(nextMonth);
    handleMonthSelect(nextMonth.getMonth());
  };

  const handleCalendarDaySelect = (day: Date) => {
    const normalized = startOfDay(day);
    if (!isSameMonth(normalized, calendarMonth)) {
      setCalendarMonth(startOfMonth(normalized));
    }
    setCalendarDay(normalized);
    handleMonthSelect(normalized.getMonth());
  };

  const birthsByMonth = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, index) => ({
      month: index,
      count: 0,
    }));
    persons.forEach((person) => {
      if (!person.birthDate) return;
      const parsed = parseDateValue(person.birthDate);
      if (!parsed) return;
      counts[getMonth(parsed)].count += 1;
    });
    return counts.map((entry) => ({
      monthIndex: entry.month,
      monthLabel: new Date(0, entry.month).toLocaleString("en-US", { month: "short" }),
      count: entry.count,
    }));
  }, [persons]);

  const deathsByMonth = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, index) => ({
      month: index,
      count: 0,
    }));
    persons.forEach((person) => {
      if (!person.deathDate) return;
      const parsed = parseDateValue(person.deathDate);
      if (!parsed) return;
      counts[getMonth(parsed)].count += 1;
    });
    return counts.map((entry) => ({
      monthIndex: entry.month,
      monthLabel: new Date(0, entry.month).toLocaleString("en-US", { month: "short" }),
      count: entry.count,
    }));
  }, [persons]);

  const marriagesByMonth = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, index) => ({
      month: index,
      count: 0,
    }));
    relationships.forEach((rel) => {
      if (rel.relationshipType !== "partner" || !rel.marriageDate) return;
      const parsed = parseDateValue(rel.marriageDate);
      if (!parsed) return;
      counts[getMonth(parsed)].count += 1;
    });
    return counts.map((entry) => ({
      monthIndex: entry.month,
      monthLabel: new Date(0, entry.month).toLocaleString("en-US", { month: "short" }),
      count: entry.count,
    }));
  }, [relationships]);

  const calendarEvents = useMemo(() => {
    const monthIndex = calendarMonth.getMonth();
    const year = calendarMonth.getFullYear();
    const events: CalendarEvent[] = [];
    const buildOccurrence = (source: Date) => {
      const candidate = new Date(year, source.getMonth(), source.getDate());
      if (candidate.getMonth() !== source.getMonth()) return null;
      return candidate;
    };

    persons.forEach((person) => {
      if (!person.birthDate) return;
      const parsed = parseDateValue(person.birthDate);
      if (!parsed) return;
      const occurrence = buildOccurrence(parsed);
      if (!occurrence || occurrence.getMonth() !== monthIndex) return;
      events.push({
        id: `birthday-${person.id}`,
        date: occurrence,
        label: person.fullName,
        type: "birthday",
        years: year - parsed.getFullYear(),
      });
    });

    persons.forEach((person) => {
      if (!person.deathDate) return;
      const parsed = parseDateValue(person.deathDate);
      if (!parsed) return;
      const occurrence = buildOccurrence(parsed);
      if (!occurrence || occurrence.getMonth() !== monthIndex) return;
      events.push({
        id: `death-${person.id}`,
        date: occurrence,
        label: person.fullName,
        type: "death",
        years: year - parsed.getFullYear(),
      });
    });

    relationships.forEach((rel) => {
      if (rel.relationshipType !== "partner" || !rel.marriageDate) return;
      const parsed = parseDateValue(rel.marriageDate);
      if (!parsed) return;
      const occurrence = buildOccurrence(parsed);
      if (!occurrence || occurrence.getMonth() !== monthIndex) return;
      const partnerA = personById.get(rel.parentId);
      const partnerB = personById.get(rel.childId);
      events.push({
        id: `marriage-${rel.id}`,
        date: occurrence,
        label: `${partnerA?.fullName ?? "Unknown member"} & ${partnerB?.fullName ?? "Unknown member"}`,
        type: "marriage",
        years: year - parsed.getFullYear(),
      });
    });

    return events.sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.label.localeCompare(b.label)
    );
  }, [calendarMonth, persons, personById, relationships]);

  const calendarEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      const key = format(event.date, "yyyy-MM-dd");
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    });
    return map;
  }, [calendarEvents]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [calendarMonth]);

  const calendarDayEvents = useMemo(() => {
    if (!calendarDay) return [];
    const key = format(calendarDay, "yyyy-MM-dd");
    return calendarEventsByDay.get(key) ?? [];
  }, [calendarDay, calendarEventsByDay]);

  const calendarUpcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const isCurrentMonth = isSameMonth(calendarMonth, today);
    return calendarEvents
      .filter((event) => (isCurrentMonth ? !isBefore(event.date, today) : true))
      .sort(
        (a, b) => a.date.getTime() - b.date.getTime() || a.label.localeCompare(b.label)
      );
  }, [calendarEvents, calendarMonth]);

  const calendarListEvents =
    calendarDayEvents.length > 0 ? calendarDayEvents : calendarUpcomingEvents;
  const calendarListLabel =
    calendarDayEvents.length > 0 && calendarDay
      ? `Milestones on ${format(calendarDay, "MMM d")}`
      : `Upcoming in ${format(calendarMonth, "MMMM")}`;
  const today = startOfDay(new Date());

  const ageDistribution = useMemo(() => {
    return ageBuckets.map((bucket) => {
      const total = persons.reduce((sum, person) => {
        const ageValue = toNumberOrNull(calculateAge(person.birthDate, person.deathDate));
        if (ageValue === null) return sum;
        if (ageValue >= bucket.min && ageValue <= bucket.max) return sum + 1;
        return sum;
      }, 0);
      return { bucket: bucket.label, count: total };
    });
  }, [persons]);

  const aliveAges = useMemo(
    () =>
      persons
        .filter((person) => person.isAlive)
        .map((person) => toNumberOrNull(calculateAge(person.birthDate)))
        .filter((value): value is number => value !== null),
    [persons]
  );

  const deceasedAges = useMemo(
    () =>
      persons
        .filter((person) => !person.isAlive)
        .map((person) => toNumberOrNull(calculateAge(person.birthDate, person.deathDate)))
        .filter((value): value is number => value !== null),
    [persons]
  );

  const ageInsights = useMemo(() => {
    const avgAlive =
      aliveAges.length > 0
        ? aliveAges.reduce((sum, value) => sum + value, 0) / aliveAges.length
        : null;
    const avgDeceased =
      deceasedAges.length > 0
        ? deceasedAges.reduce((sum, value) => sum + value, 0) / deceasedAges.length
        : null;
    const youngest = aliveAges.length > 0 ? Math.min(...aliveAges) : null;
    const oldest = aliveAges.length > 0 ? Math.max(...aliveAges) : null;

    return {
      avgAlive,
      medianAlive: medianValue(aliveAges),
      youngest,
      oldest,
      avgDeceased,
      medianDeceased: medianValue(deceasedAges),
    };
  }, [aliveAges, deceasedAges]);

  const selectedMonthPeople = useMemo(() => {
    if (selectedMonth === null) return [];
    return persons
      .filter((person) => person.birthDate)
      .map((person) => {
        const parsed = parseDateValue(person.birthDate ?? "");
        if (!parsed) return null;
        if (getMonth(parsed) !== selectedMonth) return null;
        return {
          person,
          day: parsed.getDate(),
        };
      })
      .filter(
        (entry): entry is { person: Person; day: number } => entry !== null
      )
      .sort((a, b) => (a?.day ?? 0) - (b?.day ?? 0));
  }, [persons, selectedMonth]);

  const selectedMonthDeaths = useMemo(() => {
    if (selectedMonth === null) return [];
    return persons
      .filter((person) => person.deathDate)
      .map((person) => {
        const parsed = parseDateValue(person.deathDate ?? "");
        if (!parsed) return null;
        if (getMonth(parsed) !== selectedMonth) return null;
        return {
          person,
          day: parsed.getDate(),
          year: parsed.getFullYear(),
        };
      })
      .filter(
        (entry): entry is { person: Person; day: number; year: number } =>
          entry !== null
      )
      .sort((a, b) => a.day - b.day);
  }, [persons, selectedMonth]);

  const selectedMonthMarriages = useMemo(() => {
    if (selectedMonth === null) return [];
    return relationships
      .filter((rel) => rel.relationshipType === "partner" && rel.marriageDate)
      .map((rel) => {
        const parsed = parseDateValue(rel.marriageDate ?? "");
        if (!parsed) return null;
        if (getMonth(parsed) !== selectedMonth) return null;
        const parent = personById.get(rel.parentId);
        const child = personById.get(rel.childId);
        const label = `${parent?.fullName ?? "Unknown member"} & ${child?.fullName ?? "Unknown member"}`;
        return {
          relationship: rel,
          label,
          day: parsed.getDate(),
          year: parsed.getFullYear(),
        };
      })
      .filter(
        (
          entry
        ): entry is {
          relationship: Relationship;
          label: string;
          day: number;
          year: number;
        } => entry !== null
      )
      .sort((a, b) => a.day - b.day);
  }, [personById, relationships, selectedMonth]);

  const birthsByDecade = useMemo(() => {
    const counts = new Map<number, number>();
    persons.forEach((person) => {
      if (!person.birthDate) return;
      const parsed = parseDateValue(person.birthDate);
      if (!parsed) return;
      const decade = Math.floor(parsed.getFullYear() / 10) * 10;
      counts.set(decade, (counts.get(decade) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([decade, count]) => ({ decade: `${decade}s`, count }));
  }, [persons]);

  const deathsByDecade = useMemo(() => {
    const counts = new Map<number, number>();
    persons.forEach((person) => {
      if (!person.deathDate) return;
      const parsed = parseDateValue(person.deathDate);
      if (!parsed) return;
      const decade = Math.floor(parsed.getFullYear() / 10) * 10;
      counts.set(decade, (counts.get(decade) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([decade, count]) => ({ decade: `${decade}s`, count }));
  }, [persons]);

  const locationStats = useMemo(() => {
    const counts = new Map<string, number>();
    persons.forEach((person) => {
      const location = person.stats?.location?.trim();
      if (!location) return;
      counts.set(location, (counts.get(location) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([location, count]) => ({ location, count }));
  }, [persons]);

  const locationPeople = useMemo(() => {
    if (!selectedLocation) return [];
    return persons
      .filter((person) => person.stats?.location?.trim() === selectedLocation)
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [persons, selectedLocation]);

  const dataCompleteness = useMemo(() => {
    const missingBirth = persons.filter((person) => !person.birthDate).length;
    const missingLocation = persons.filter((person) => !person.stats?.location).length;
    const missingGender = persons.filter((person) => !person.gender).length;
    return { missingBirth, missingLocation, missingGender };
  }, [persons]);

  const familyUnits = useMemo(() => {
    const parentLinks = relationships.filter((rel) => rel.relationshipType === "parent");
    if (parentLinks.length === 0) return [];
    const childToParents = new Map<string, Set<string>>();
    parentLinks.forEach((rel) => {
      if (!childToParents.has(rel.childId)) {
        childToParents.set(rel.childId, new Set());
      }
      childToParents.get(rel.childId)?.add(rel.parentId);
    });

    const families = new Map<
      string,
      { parentIds: string[]; childIds: Set<string> }
    >();

    childToParents.forEach((parentSet, childId) => {
      const parentIds = Array.from(parentSet);
      if (parentIds.length === 0) return;
      parentIds.sort();
      const key = parentIds.join("|");
      if (!families.has(key)) {
        families.set(key, { parentIds, childIds: new Set() });
      }
      families.get(key)?.childIds.add(childId);
    });

    return Array.from(families.values())
      .map((entry) => {
        const parentNames = entry.parentIds.map(
          (parentId) =>
            persons.find((person) => person.id === parentId)?.fullName ?? "Unknown member"
        );
        return {
          label: parentNames.join(" & "),
          count: entry.childIds.size,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [persons, relationships]);

  const familyStats = useMemo(() => {
    const counts = familyUnits.map((entry) => entry.count);
    const avgChildren =
      counts.length > 0 ? counts.reduce((sum, value) => sum + value, 0) / counts.length : null;
    return {
      avgChildren,
      medianChildren: counts.length > 0 ? medianValue(counts) : null,
    };
  }, [familyUnits]);

  const totalFamilyPages = Math.max(1, Math.ceil(familyUnits.length / familyPageSize));

  const familyPageItems = useMemo(() => {
    const start = (familyPage - 1) * familyPageSize;
    return familyUnits.slice(start, start + familyPageSize);
  }, [familyPage, familyPageSize, familyUnits]);

  const statusPeople = useMemo(() => {
    if (!selectedStatus) return [];
    return persons
      .filter((person) => (selectedStatus === "alive" ? person.isAlive : !person.isAlive))
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [persons, selectedStatus]);

  useEffect(() => {
    setFamilyPage((prev) => Math.min(Math.max(1, prev), totalFamilyPages));
  }, [totalFamilyPages]);
  const handleStatusClick = (name?: string) => {
    const next =
      name === "Alive" ? "alive" : name === "Deceased" ? "deceased" : null;
    if (!next) return;
    setSelectedStatus((prev) => (prev === next ? null : next));
  };

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
          <div>
            <h2 className="text-2xl text-slate-900">Family Snapshot</h2>
            <p className="text-sm text-slate-600">
              Alive versus deceased distribution with age insights.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="surface-card rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Status Mix
              </p>
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={aliveBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={35}
                      outerRadius={60}
                      onClick={(data) => handleStatusClick(data?.name)}
                    >
                      {aliveBreakdown.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === "Alive" ? "#2f6f4e" : "#e76f51"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>Alive: {aliveCount}</span>
                <span>Deceased: {deceasedCount}</span>
              </div>
            </div>
            <div className="surface-card rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Age Spread
              </p>
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageDistribution}>
                    <XAxis dataKey="bucket" fontSize={10} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1f6f8b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-500">Avg age (alive)</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {ageInsights.avgAlive ? Math.round(ageInsights.avgAlive) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Median age</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {ageInsights.medianAlive ? Math.round(ageInsights.medianAlive) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Youngest</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {ageInsights.youngest ?? "N/A"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Oldest</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {ageInsights.oldest ?? "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Status list
              </p>
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setSelectedStatus(null)}
                type="button"
              >
                Clear
              </button>
            </div>
            {selectedStatus ? (
              <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                {statusPeople.length === 0 && (
                  <p className="text-sm text-slate-500">No members found.</p>
                )}
                {statusPeople.map((person) => (
                  <div key={person.id} className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{person.fullName}</span>
                    <span className="text-xs text-slate-500">
                      Age {calculateAge(person.birthDate, person.deathDate)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Click Alive or Deceased on the chart to list members.
              </p>
            )}
          </div>
        </div>
        <div className="glass-card rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl text-slate-900">Milestones Across the Year</h2>
              <p className="text-sm text-slate-600">
                Click a month to see birthdays, memorials, and marriage anniversaries.
              </p>
            </div>
            <button
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              onClick={() => handleMonthSelect(null)}
              type="button"
            >
              Clear selection
            </button>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Birthdays
              </p>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={birthsByMonth}>
                    <XAxis dataKey="monthLabel" fontSize={10} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      onClick={(data) => handleMonthSelect(data?.monthIndex ?? null)}
                    >
                      {birthsByMonth.map((entry) => (
                        <Cell
                          key={entry.monthIndex}
                          fill={selectedMonth === entry.monthIndex ? "#f08b32" : "#f1b34c"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Deaths
              </p>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deathsByMonth}>
                    <XAxis dataKey="monthLabel" fontSize={10} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      onClick={(data) => handleMonthSelect(data?.monthIndex ?? null)}
                    >
                      {deathsByMonth.map((entry) => (
                        <Cell
                          key={entry.monthIndex}
                          fill={selectedMonth === entry.monthIndex ? "#c44536" : "#d07f6f"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Marriages
              </p>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marriagesByMonth}>
                    <XAxis dataKey="monthLabel" fontSize={10} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      onClick={(data) => handleMonthSelect(data?.monthIndex ?? null)}
                    >
                      {marriagesByMonth.map((entry) => (
                        <Cell
                          key={entry.monthIndex}
                          fill={selectedMonth === entry.monthIndex ? "#2f6f4e" : "#6fa37f"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {selectedMonth === null
                ? "Select a month"
                : `${new Date(0, selectedMonth).toLocaleString("en-US", {
                    month: "long",
                  })} birthdays`}
            </p>
            {selectedMonth === null ? (
              <p className="mt-2 text-sm text-slate-600">
                Pick a bar to see members and stats for that month.
              </p>
            ) : (
              <div className="mt-3 max-h-56 space-y-2 overflow-auto text-sm text-slate-700">
                {selectedMonthPeople.length === 0 && (
                  <p className="text-sm text-slate-500">No birthdays for this month.</p>
                )}
                {selectedMonthPeople.map((entry) => {
                  const person = entry.person;
                  return (
                    <div key={person.id} className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-800">{person.fullName}</span>
                      <span className="text-xs text-slate-500">
                        Day {entry.day} - Age {calculateAge(person.birthDate, person.deathDate)} -
                        {person.stats?.location ?? "Unknown"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {selectedMonth === null
                ? "Select a month"
                : `${new Date(0, selectedMonth).toLocaleString("en-US", {
                    month: "long",
                  })} anniversaries`}
            </p>
            {selectedMonth === null ? (
              <p className="mt-2 text-sm text-slate-600">
                Pick a bar to see memorials and marriage anniversaries.
              </p>
            ) : (
              <div className="mt-3 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Death anniversaries
                  </p>
                  <div className="mt-2 max-h-40 space-y-2 overflow-auto">
                    {selectedMonthDeaths.length === 0 && (
                      <p className="text-sm text-slate-500">No memorials for this month.</p>
                    )}
                    {selectedMonthDeaths.map((entry) => (
                      <div
                        key={entry.person.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-semibold text-slate-800">
                          {entry.person.fullName}
                        </span>
                        <span className="text-xs text-slate-500">
                          Day {entry.day} - {entry.year}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Marriage anniversaries
                  </p>
                  <div className="mt-2 max-h-40 space-y-2 overflow-auto">
                    {selectedMonthMarriages.length === 0 && (
                      <p className="text-sm text-slate-500">No anniversaries for this month.</p>
                    )}
                    {selectedMonthMarriages.map((entry) => (
                      <div
                        key={entry.relationship.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-semibold text-slate-800">{entry.label}</span>
                        <span className="text-xs text-slate-500">
                          Day {entry.day} - {entry.year}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="glass-card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl text-slate-900">Milestone Calendar</h2>
            <p className="text-sm text-slate-600">
              Upcoming birthdays, memorials, and anniversaries in a monthly view.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              onClick={() => handleCalendarShift("prev")}
              type="button"
            >
              Previous
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {format(calendarMonth, "MMMM yyyy")}
            </span>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              onClick={() => handleCalendarShift("next")}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
            <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2 text-sm">
              {calendarDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayEvents = calendarEventsByDay.get(dayKey) ?? [];
                const isOutside = !isSameMonth(day, calendarMonth);
                const isSelected = calendarDay ? isSameDay(day, calendarDay) : false;
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={dayKey}
                    className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2 text-xs transition ${
                      isSelected
                        ? "border-amber-300 bg-amber-50 text-slate-900"
                        : "border-transparent hover:border-slate-200 hover:bg-white"
                    } ${isOutside ? "text-slate-400" : "text-slate-700"}`}
                    onClick={() => handleCalendarDaySelect(day)}
                    type="button"
                  >
                    <span className={`text-xs font-semibold ${isToday ? "text-amber-600" : ""}`}>
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 flex items-center gap-1">
                      {(["birthday", "marriage", "death"] as const).map((type) =>
                        dayEvents.some((event) => event.type === type) ? (
                          <span key={type} className={`h-2 w-2 rounded-full ${milestoneMeta[type].dot}`} />
                        ) : null
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {calendarListLabel}
              </p>
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => handleCalendarDaySelect(today)}
                type="button"
              >
                Today
              </button>
            </div>
            {calendarListEvents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No milestones scheduled.</p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
                {calendarListEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${milestoneMeta[event.type].dot}`} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{event.label}</p>
                        <p className={`text-xs ${milestoneMeta[event.type].text}`}>
                          {milestoneMeta[event.type].label}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {format(event.date, "MMM d")} - {event.years} yrs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card rounded-3xl p-6">
          <h2 className="text-2xl text-slate-900">Births & Deaths by Decade</h2>
          <p className="text-sm text-slate-600">
            Historical view of family growth and life events.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Births
              </p>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={birthsByDecade}>
                    <XAxis dataKey="decade" fontSize={10} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4c9f70" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Deaths
              </p>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deathsByDecade}>
                    <XAxis dataKey="decade" fontSize={10} />
                    <YAxis allowDecimals={false} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#c44536" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-500">Avg age at death</p>
              <p className="text-lg font-semibold text-slate-900">
                {ageInsights.avgDeceased ? Math.round(ageInsights.avgDeceased) : "N/A"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Median age at death</p>
              <p className="text-lg font-semibold text-slate-900">
                {ageInsights.medianDeceased ? Math.round(ageInsights.medianDeceased) : "N/A"}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-6">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl text-slate-900">Location Highlights</h2>
                <p className="text-sm text-slate-600">Most common locations in the clan.</p>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setSelectedLocation(null)}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {locationStats.length === 0 && (
                <p className="text-sm text-slate-500">No locations recorded yet.</p>
              )}
              {locationStats.map((entry) => (
                <button
                  key={entry.location}
                  className="flex w-full items-center justify-between rounded-xl border border-transparent px-2 py-2 text-left text-sm hover:border-amber-200 hover:bg-amber-50"
                  onClick={() =>
                    setSelectedLocation((prev) =>
                      prev === entry.location ? null : entry.location
                    )
                  }
                  type="button"
                >
                  <span className="font-semibold text-slate-800">{entry.location}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {entry.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {selectedLocation ? `${selectedLocation} members` : "Select a location"}
              </p>
              {selectedLocation ? (
                <div className="mt-2 max-h-40 space-y-2 overflow-auto">
                  {locationPeople.length === 0 && (
                    <p className="text-sm text-slate-500">No members in this location.</p>
                  )}
                  {locationPeople.map((person) => (
                    <div key={person.id} className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{person.fullName}</span>
                      <span className="text-xs text-slate-500">
                        Age {calculateAge(person.birthDate, person.deathDate)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Pick a location to view matching members.
                </p>
              )}
            </div>
          </div>
          <div className="glass-card rounded-3xl p-6">
            <h2 className="text-2xl text-slate-900">Data Completeness</h2>
            <p className="text-sm text-slate-600">Track missing details to improve stats.</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Birthdays</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {dataCompleteness.missingBirth}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Location</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {dataCompleteness.missingLocation}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Gender</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {dataCompleteness.missingGender}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="glass-card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl text-slate-900">Family Size</h2>
            <p className="text-sm text-slate-600">
              Partnered parents are grouped into one family entry.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Page {familyPage} of {totalFamilyPages}
            </span>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              onClick={() => setFamilyPage((prev) => Math.max(1, prev - 1))}
              disabled={familyPage <= 1}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              onClick={() => setFamilyPage((prev) => Math.min(totalFamilyPages, prev + 1))}
              disabled={familyPage >= totalFamilyPages}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div>
            <p className="font-semibold text-slate-500">Avg children per family</p>
            <p className="text-lg font-semibold text-slate-900">
              {familyStats.avgChildren ? familyStats.avgChildren.toFixed(1) : "N/A"}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-500">Median children</p>
            <p className="text-lg font-semibold text-slate-900">
              {familyStats.medianChildren ?? "N/A"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {familyUnits.length === 0 && (
            <p className="text-sm text-slate-500">No parent links yet.</p>
          )}
          {familyPageItems.map((entry) => (
            <div key={entry.label} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-800">{entry.label}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {entry.count} children
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
