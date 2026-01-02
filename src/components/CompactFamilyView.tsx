"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp } from "lucide-react";
import type { Person, Relationship } from "@/lib/types";

type CompactFamilyViewProps = {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
};

const emptySummary = {
  parents: [] as Person[],
  partners: [] as Person[],
  siblings: [] as Person[],
  children: [] as Person[],
};

const sortByName = (a: Person, b: Person) =>
  a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });

export const CompactFamilyView = ({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: CompactFamilyViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (persons.length === 0) return;
    if (selectedPersonId && persons.some((person) => person.id === selectedPersonId)) {
      return;
    }
    onSelectPerson(persons[0].id);
  }, [persons, selectedPersonId, onSelectPerson]);

  const sortedPersons = useMemo(() => [...persons].sort(sortByName), [persons]);

  const focusPerson = useMemo(() => {
    if (selectedPersonId) {
      return persons.find((person) => person.id === selectedPersonId);
    }
    return persons[0];
  }, [persons, selectedPersonId]);

  const relationshipSummary = useMemo(() => {
    const personId = focusPerson?.id;
    if (!personId) return emptySummary;

    const parentLinks = relationships.filter(
      (rel) => rel.relationshipType === "parent" && rel.childId === personId
    );
    const childLinks = relationships.filter(
      (rel) => rel.relationshipType === "parent" && rel.parentId === personId
    );
    const partnerLinks = relationships.filter(
      (rel) =>
        rel.relationshipType === "partner" &&
        (rel.parentId === personId || rel.childId === personId)
    );

    const parents = parentLinks
      .map((rel) => persons.find((person) => person.id === rel.parentId))
      .filter(Boolean) as Person[];
    const children = childLinks
      .map((rel) => persons.find((person) => person.id === rel.childId))
      .filter(Boolean) as Person[];
    const partners = partnerLinks
      .map((rel) =>
        persons.find(
          (person) => person.id === (rel.parentId === personId ? rel.childId : rel.parentId)
        )
      )
      .filter(Boolean) as Person[];

    const parentIdSet = new Set(parentLinks.map((rel) => rel.parentId));
    const siblingIds = new Set(
      relationships
        .filter(
          (rel) => rel.relationshipType === "parent" && parentIdSet.has(rel.parentId)
        )
        .map((rel) => rel.childId)
    );
    siblingIds.delete(personId);
    const siblings = Array.from(siblingIds)
      .map((id) => persons.find((person) => person.id === id))
      .filter(Boolean) as Person[];

    return {
      parents: parents.sort(sortByName),
      partners: partners.sort(sortByName),
      siblings: siblings.sort(sortByName),
      children: children.sort(sortByName),
    };
  }, [focusPerson?.id, persons, relationships]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return persons
      .filter((person) => person.fullName.toLowerCase().includes(query))
      .slice(0, 8);
  }, [persons, searchQuery]);

  const renderList = (items: Person[], emptyText: string) => {
    if (items.length === 0) {
      return <p className="mt-2 text-xs text-slate-500">{emptyText}</p>;
    }
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((person) => (
          <button
            key={person.id}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50"
            onClick={() => onSelectPerson(person.id)}
            type="button"
          >
            {person.fullName}
          </button>
        ))}
      </div>
    );
  };

  if (persons.length === 0) {
    return (
      <section className="glass-card flex min-h-[520px] flex-col gap-4 rounded-3xl p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Compact
          </p>
          <h3 className="mt-2 text-xl text-slate-900">Add your first member</h3>
          <p className="mt-1 text-sm text-slate-600">
            Once you add people and link relationships, the compact map will appear here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card flex min-h-[520px] flex-col gap-5 rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Focus Member
          </p>
          <select
            className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            value={focusPerson?.id ?? ""}
            onChange={(event) => onSelectPerson(event.target.value)}
          >
            {sortedPersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Quick Search
          </p>
          <input
            className="mt-1 w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            placeholder="Search name"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
              {searchResults.map((person) => (
                <button
                  key={person.id}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-amber-50"
                  onClick={() => {
                    onSelectPerson(person.id);
                    setSearchQuery(person.fullName);
                  }}
                  type="button"
                >
                  <span className="truncate">{person.fullName}</span>
                  <span className="text-[10px] text-slate-400">Focus</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-3">
        <div className="md:col-start-2 md:row-start-1">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Parents
              </p>
              <ArrowUp size={16} className="text-slate-400" />
            </div>
            {renderList(relationshipSummary.parents, "No parents linked.")}
          </div>
        </div>

        <div className="md:col-start-1 md:row-start-2">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Partners
              </p>
              <ArrowLeftRight size={16} className="text-slate-400" />
            </div>
            {renderList(relationshipSummary.partners, "No partners linked.")}
          </div>
        </div>

        <div className="md:col-start-2 md:row-start-2">
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Focus
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              {focusPerson?.fullName ?? "Select a member"}
            </h3>
            {focusPerson && (
              <p className="mt-1 text-sm text-slate-600">
                {focusPerson.isAlive ? "Alive" : "Deceased"}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase text-slate-600">
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                Parents {relationshipSummary.parents.length}
              </span>
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                Partners {relationshipSummary.partners.length}
              </span>
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                Siblings {relationshipSummary.siblings.length}
              </span>
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
                Children {relationshipSummary.children.length}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-start-3 md:row-start-2">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Siblings
              </p>
              <ArrowLeftRight size={16} className="text-slate-400" />
            </div>
            {renderList(relationshipSummary.siblings, "No siblings linked.")}
          </div>
        </div>

        <div className="md:col-start-2 md:row-start-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Children
              </p>
              <ArrowDown size={16} className="text-slate-400" />
            </div>
            {renderList(relationshipSummary.children, "No children linked.")}
          </div>
        </div>
      </div>
    </section>
  );
};
