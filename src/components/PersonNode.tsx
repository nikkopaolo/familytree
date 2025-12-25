"use client";

import Image from "next/image";
import type { NodeProps } from "reactflow";
import { calculateAge, formatYear } from "@/lib/utils";
import type { Person } from "@/lib/types";

type PersonNodeData = {
  person: Person;
  canEdit: boolean;
  onAddChild: () => void;
  onAddPartner: () => void;
};

export const PersonNode = ({ data, selected }: NodeProps<PersonNodeData>) => {
  const { person, canEdit, onAddChild, onAddPartner } = data;
  const ageLabel = calculateAge(person.birthDate, person.deathDate);
  const statusLabel = person.isAlive ? "Alive" : "Deceased";
  const statusTone = person.isAlive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";

  return (
    <div
      className={`react-flow__node-person w-[230px] rounded-2xl px-4 py-3 transition ${
        selected ? "ring-2 ring-amber-300" : "ring-0"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="size-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {person.photoUrl ? (
              <Image
                src={person.photoUrl}
                alt={person.fullName}
                width={40}
                height={40}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center text-[10px] font-semibold text-slate-400">
                No photo
              </div>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{person.fullName}</h3>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Born {formatYear(person.birthDate)} - Age {ageLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="chip rounded-full px-2 py-1 text-slate-600">
          {person.gender ?? "Unspecified"}
        </span>
        <span className="chip rounded-full px-2 py-1 text-slate-600">
          {person.stats?.location ?? "Location pending"}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            canEdit ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (canEdit) onAddChild();
          }}
          type="button"
        >
          Add child
        </button>
        <button
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            canEdit ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (canEdit) onAddPartner();
          }}
          type="button"
        >
          Add partner
        </button>
      </div>
    </div>
  );
};
