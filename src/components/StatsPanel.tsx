"use client";

import { useMemo, useState } from "react";
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
import { calculateAge } from "@/lib/utils";
import { getMonth, isValid, parseISO } from "date-fns";

type StatsPanelProps = {
  persons: Person[];
  relationships?: Relationship[];
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

export const StatsPanel = ({ persons, relationships = [] }: StatsPanelProps) => {
  const aliveCount = persons.filter((person) => person.isAlive).length;
  const deceasedCount = persons.length - aliveCount;
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const aliveBreakdown = [
    { name: "Alive", value: aliveCount },
    { name: "Deceased", value: deceasedCount },
  ];

  const birthsByMonth = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, index) => ({
      month: index,
      count: 0,
    }));
    persons.forEach((person) => {
      if (!person.birthDate) return;
      const parsed = parseISO(person.birthDate);
      if (!isValid(parsed)) return;
      counts[getMonth(parsed)].count += 1;
    });
    return counts.map((entry) => ({
      monthIndex: entry.month,
      monthLabel: new Date(0, entry.month).toLocaleString("en-US", { month: "short" }),
      count: entry.count,
    }));
  }, [persons]);

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
        const parsed = parseISO(person.birthDate ?? "");
        if (!isValid(parsed)) return null;
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

  const birthsByDecade = useMemo(() => {
    const counts = new Map<number, number>();
    persons.forEach((person) => {
      if (!person.birthDate) return;
      const parsed = parseISO(person.birthDate);
      if (!isValid(parsed)) return;
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
      const parsed = parseISO(person.deathDate);
      if (!isValid(parsed)) return;
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

  const dataCompleteness = useMemo(() => {
    const total = persons.length;
    const missingBirth = persons.filter((person) => !person.birthDate).length;
    const missingLocation = persons.filter((person) => !person.stats?.location).length;
    const missingGender = persons.filter((person) => !person.gender).length;
    return { total, missingBirth, missingLocation, missingGender };
  }, [persons]);

  const familySizeStats = useMemo(() => {
    const parentLinks = relationships.filter((rel) => rel.relationshipType === "parent");
    if (parentLinks.length === 0) {
      return { avgChildren: null, medianChildren: null, topParents: [] as Array<{ name: string; count: number }> };
    }
    const childrenMap = new Map<string, Set<string>>();
    parentLinks.forEach((rel) => {
      if (!childrenMap.has(rel.parentId)) {
        childrenMap.set(rel.parentId, new Set());
      }
      childrenMap.get(rel.parentId)?.add(rel.childId);
    });
    const childCounts = Array.from(childrenMap.values()).map((set) => set.size);
    const avgChildren =
      childCounts.length > 0
        ? childCounts.reduce((sum, value) => sum + value, 0) / childCounts.length
        : null;
    const topParents = Array.from(childrenMap.entries())
      .map(([parentId, set]) => {
        const parent = persons.find((person) => person.id === parentId);
        return { name: parent?.fullName ?? "Unknown member", count: set.size };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      avgChildren,
      medianChildren: medianValue(childCounts),
      topParents,
    };
  }, [persons, relationships]);


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
        </div>
      </div>
      <div className="glass-card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl text-slate-900">Birthdays Across the Year</h2>
            <p className="text-sm text-slate-600">
              Click a month to see members celebrating.
            </p>
          </div>
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            onClick={() => setSelectedMonth(null)}
            type="button"
          >
            Clear selection
          </button>
        </div>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={birthsByMonth}>
              <XAxis dataKey="monthLabel" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar
                dataKey="count"
                radius={[10, 10, 0, 0]}
                onClick={(data) => setSelectedMonth(data?.monthIndex ?? null)}
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
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
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
            <h2 className="text-2xl text-slate-900">Location Highlights</h2>
            <p className="text-sm text-slate-600">Most common locations in the clan.</p>
            <div className="mt-4 space-y-2">
              {locationStats.length === 0 && (
                <p className="text-sm text-slate-500">No locations recorded yet.</p>
              )}
              {locationStats.map((entry) => (
                <div key={entry.location} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800">{entry.location}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {entry.count}
                  </span>
                </div>
              ))}
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
          <div className="glass-card rounded-3xl p-6">
            <h2 className="text-2xl text-slate-900">Family Size</h2>
            <p className="text-sm text-slate-600">Parent and child relationships overview.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-500">Avg children per parent</p>
                <p className="text-lg font-semibold text-slate-900">
                  {familySizeStats.avgChildren ? familySizeStats.avgChildren.toFixed(1) : "N/A"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500">Median children</p>
                <p className="text-lg font-semibold text-slate-900">
                  {familySizeStats.medianChildren ?? "N/A"}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {familySizeStats.topParents.length === 0 && (
                <p className="text-sm text-slate-500">No parent links yet.</p>
              )}
              {familySizeStats.topParents.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800">{entry.name}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {entry.count} children
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
