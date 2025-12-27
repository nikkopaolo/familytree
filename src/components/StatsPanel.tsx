"use client";

import { useMemo } from "react";
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
import type { Person } from "@/lib/types";
import { calculateAge } from "@/lib/utils";
import { getMonth, isValid, parseISO } from "date-fns";

type StatsPanelProps = {
  persons: Person[];
};

const ageBuckets = [
  { label: "0-19", min: 0, max: 19 },
  { label: "20-39", min: 20, max: 39 },
  { label: "40-59", min: 40, max: 59 },
  { label: "60+", min: 60, max: 150 },
];

export const StatsPanel = ({ persons }: StatsPanelProps) => {
  const aliveCount = persons.filter((person) => person.isAlive).length;
  const deceasedCount = persons.length - aliveCount;

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
      month: new Date(0, entry.month).toLocaleString("en-US", { month: "short" }),
      count: entry.count,
    }));
  }, [persons]);

  const ageDistribution = useMemo(() => {
    return ageBuckets.map((bucket) => {
      const total = persons.reduce((sum, person) => {
        const ageValue = Number(calculateAge(person.birthDate, person.deathDate));
        if (!Number.isFinite(ageValue)) return sum;
        if (ageValue >= bucket.min && ageValue <= bucket.max) return sum + 1;
        return sum;
      }, 0);
      return { bucket: bucket.label, count: total };
    });
  }, [persons]);


  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="glass-card flex flex-col gap-6 rounded-3xl p-6">
        <div>
          <h2 className="text-2xl text-slate-900">Family Snapshot</h2>
          <p className="text-sm text-slate-600">
            Alive versus deceased distribution with monthly birthdays.
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
                  <Pie data={aliveBreakdown} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60}>
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
          </div>
        </div>
      </div>
      <div className="glass-card rounded-3xl p-6">
        <h2 className="text-2xl text-slate-900">Birthdays Across the Year</h2>
        <p className="text-sm text-slate-600">Track celebrations and anniversaries by month.</p>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={birthsByMonth}>
              <XAxis dataKey="month" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#f1b34c" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
