"use client";

import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import { Check, Edit3, UserRound, X } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";
import { calculateAge, formatDate } from "@/lib/utils";
import type { Person } from "@/lib/types";

type PersonNodeData = {
  person: Person;
  stats: {
    parents: number;
    children: number;
    partners: number;
    siblings: number;
  };
  links: {
    parents: Array<{ id: string; person: Person }>;
    children: Array<{ id: string; person: Person }>;
    partners: Array<{ id: string; person: Person }>;
    eligibleParents: Person[];
    eligibleChildren: Person[];
    eligiblePartners: Person[];
  };
  canEdit: boolean;
  onAddChild: () => void;
  onAddPartner: () => void;
  onUpdate: (payload: Record<string, unknown>) => Promise<void> | void;
  onEditStateChange: (id: string, editing: boolean) => void;
  onDeleteRelationship: (relationshipId: string) => void;
  onLinkParent: (parentId: string) => void;
  onLinkChild: (childId: string) => void;
  onLinkPartner: (partnerId: string) => void;
};

const MaleIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="15" r="4" />
    <path d="M12 12l7-7" />
    <path d="M14 5h5v5" />
  </svg>
);

const FemaleIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M12 12v8" />
    <path d="M9 17h6" />
  </svg>
);

export const PersonNode = ({ data, selected }: NodeProps<PersonNodeData>) => {
  const {
    person,
    stats,
    links,
    canEdit,
    onAddChild,
    onAddPartner,
    onUpdate,
    onEditStateChange,
    onDeleteRelationship,
    onLinkParent,
    onLinkChild,
    onLinkPartner,
  } = data;
  const ageLabel = calculateAge(person.birthDate, person.deathDate);
  const statusLabel = person.isAlive ? "Alive" : "Deceased";
  const statusTone = person.isAlive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
  const genderValue = person.gender?.toLowerCase() ?? "";
  const isFemale = genderValue.startsWith("f");
  const isMale = genderValue.startsWith("m");
  const genderLabel = isFemale ? "Female" : isMale ? "Male" : "Unspecified";
  const genderTone = isFemale
    ? "border-rose-200 bg-rose-100 text-rose-700"
    : isMale
      ? "border-sky-200 bg-sky-100 text-sky-700"
      : "border-slate-200 bg-slate-100 text-slate-500";
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState({
    fullName: person.fullName,
    birthDate: person.birthDate ?? "",
    deathDate: person.deathDate ?? "",
    gender: isFemale ? "Female" : isMale ? "Male" : "",
    location: person.stats?.location ?? "",
    isAlive: person.isAlive,
  });
  const [linkState, setLinkState] = useState({
    parentId: "",
    childId: "",
    partnerId: "",
  });

  useEffect(() => {
    if (isEditing) return;
    setFormState({
      fullName: person.fullName,
      birthDate: person.birthDate ?? "",
      deathDate: person.deathDate ?? "",
      gender: isFemale ? "Female" : isMale ? "Male" : "",
      location: person.stats?.location ?? "",
      isAlive: person.isAlive,
    });
  }, [
    isEditing,
    isFemale,
    isMale,
    person.birthDate,
    person.deathDate,
    person.fullName,
    person.isAlive,
    person.stats?.location,
  ]);

  useEffect(() => {
    setIsEditing(false);
    setIsSaving(false);
    setLinkState({ parentId: "", childId: "", partnerId: "" });
  }, [person.id]);

  useEffect(() => {
    onEditStateChange(person.id, isEditing);
    return () => {
      onEditStateChange(person.id, false);
    };
  }, [isEditing, onEditStateChange, person.id]);

  const startEditing = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canEdit) return;
    setFormState({
      fullName: person.fullName,
      birthDate: person.birthDate ?? "",
      deathDate: person.deathDate ?? "",
      gender: isFemale ? "Female" : isMale ? "Male" : "",
      location: person.stats?.location ?? "",
      isAlive: person.isAlive,
    });
    setIsEditing(true);
  };

  const cancelEditing = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsEditing(false);
  };

  const saveChanges = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsSaving(true);
    const nameValue = formState.fullName.trim();
    const locationValue = formState.location.trim();
    await onUpdate(
      {
        fullName: nameValue || person.fullName,
        birthDate: formState.birthDate || null,
        deathDate: formState.isAlive ? null : formState.deathDate || null,
        gender: formState.gender || null,
        location: locationValue || null,
        isAlive: formState.isAlive,
      }
    );
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleRemoveLink =
    (relationshipId: string) => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onDeleteRelationship(relationshipId);
    };

  const handleLinkParent = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!linkState.parentId) return;
    onLinkParent(linkState.parentId);
    setLinkState((prev) => ({ ...prev, parentId: "" }));
  };

  const handleLinkChild = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!linkState.childId) return;
    onLinkChild(linkState.childId);
    setLinkState((prev) => ({ ...prev, childId: "" }));
  };

  const handleLinkPartner = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!linkState.partnerId) return;
    onLinkPartner(linkState.partnerId);
    setLinkState((prev) => ({ ...prev, partnerId: "" }));
  };
  return (
    <div
      className={`react-flow__node-person group relative w-[280px] min-h-[170px] overflow-visible rounded-2xl px-4 py-3 transition hover:z-50 ${
        isEditing ? "z-50" : "z-0"
      } ${selected ? "ring-2 ring-amber-300" : "ring-0"}`}
      style={isEditing ? { zIndex: 1000 } : undefined}
    >
      <Handle id="parent-top" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="parent-bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="parent-left" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="parent-right" type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="partner-top" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="partner-bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="partner-left" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="partner-right" type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div className="pointer-events-none absolute left-full top-3 z-50 hidden w-44 translate-x-2 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-600 shadow-xl backdrop-blur group-hover:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Live stats
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span>Parents</span>
            <span className="font-semibold text-slate-700">{stats.parents}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Partners</span>
            <span className="font-semibold text-slate-700">{stats.partners}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Children</span>
            <span className="font-semibold text-slate-700">{stats.children}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Siblings</span>
            <span className="font-semibold text-slate-700">{stats.siblings}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-2">
          <div
            className={`flex size-10 items-center justify-center rounded-full border ${genderTone}`}
            aria-label={genderLabel}
            title={genderLabel}
          >
            {isFemale ? (
              <FemaleIcon className="size-5" />
            ) : isMale ? (
              <MaleIcon className="size-5" />
            ) : (
              <UserRound className="size-5" />
            )}
          </div>
          <div className="size-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
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
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight text-slate-900 break-words">
                {person.fullName}
              </h3>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {genderLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone}`}
              >
                {statusLabel}
              </span>
              {canEdit && (
                <button
                  className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition hover:text-slate-800"
                  onClick={startEditing}
                  type="button"
                  aria-label="Edit member"
                  title="Edit member"
                >
                  <Edit3 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Birthday {formatDate(person.birthDate)} - Age {ageLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Location {person.stats?.location ?? "Unknown"}
          </p>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Full name
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1 text-xs"
              value={formState.fullName}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, fullName: event.target.value }))
              }
              onMouseDown={(event) => event.stopPropagation()}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Birthday
              </span>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1 text-xs"
                value={formState.birthDate}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, birthDate: event.target.value }))
                }
                onMouseDown={(event) => event.stopPropagation()}
              />
            </label>
            {!formState.isAlive && (
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Deceased date
                </span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1 text-xs"
                  value={formState.deathDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, deathDate: event.target.value }))
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                />
              </label>
            )}
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Gender
              </span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1 text-xs"
                value={formState.gender}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, gender: event.target.value }))
                }
                onMouseDown={(event) => event.stopPropagation()}
              >
                <option value="">Unspecified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Status
              </span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1 text-xs"
                value={formState.isAlive ? "alive" : "deceased"}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    isAlive: event.target.value === "alive",
                    deathDate: event.target.value === "alive" ? "" : prev.deathDate,
                  }))
                }
                onMouseDown={(event) => event.stopPropagation()}
              >
                <option value="alive">Alive</option>
                <option value="deceased">Deceased</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Location
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1 text-xs"
              value={formState.location}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, location: event.target.value }))
              }
              onMouseDown={(event) => event.stopPropagation()}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
              onClick={saveChanges}
              onMouseDown={(event) => event.stopPropagation()}
              disabled={isSaving}
              type="button"
            >
              <Check size={12} />
              Save
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
              onClick={cancelEditing}
              onMouseDown={(event) => event.stopPropagation()}
              type="button"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Relationships
            </p>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Parents
                </p>
                {links.parents.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {links.parents.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1"
                      >
                        <span className="truncate text-xs text-slate-700">{item.person.fullName}</span>
                        {canEdit && (
                          <button
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
                            onClick={handleRemoveLink(item.id)}
                            onMouseDown={(event) => event.stopPropagation()}
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No parents linked.</p>
                )}
                {canEdit && (
                  <div className="mt-2 flex gap-2">
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      value={linkState.parentId}
                      onChange={(event) =>
                        setLinkState((prev) => ({ ...prev, parentId: event.target.value }))
                      }
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <option value="">Link existing parent</option>
                      {links.eligibleParents.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                      onClick={handleLinkParent}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={!linkState.parentId}
                      type="button"
                    >
                      Link
                    </button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Children
                </p>
                {links.children.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {links.children.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1"
                      >
                        <span className="truncate text-xs text-slate-700">{item.person.fullName}</span>
                        {canEdit && (
                          <button
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
                            onClick={handleRemoveLink(item.id)}
                            onMouseDown={(event) => event.stopPropagation()}
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No children linked.</p>
                )}
                {canEdit && (
                  <div className="mt-2 flex gap-2">
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      value={linkState.childId}
                      onChange={(event) =>
                        setLinkState((prev) => ({ ...prev, childId: event.target.value }))
                      }
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <option value="">Link existing child</option>
                      {links.eligibleChildren.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                      onClick={handleLinkChild}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={!linkState.childId}
                      type="button"
                    >
                      Link
                    </button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Partners
                </p>
                {links.partners.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {links.partners.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1"
                      >
                        <span className="truncate text-xs text-slate-700">{item.person.fullName}</span>
                        {canEdit && (
                          <button
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
                            onClick={handleRemoveLink(item.id)}
                            onMouseDown={(event) => event.stopPropagation()}
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No partners linked.</p>
                )}
                {canEdit && (
                  <div className="mt-2 flex gap-2">
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      value={linkState.partnerId}
                      onChange={(event) =>
                        setLinkState((prev) => ({ ...prev, partnerId: event.target.value }))
                      }
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <option value="">Link existing partner</option>
                      {links.eligiblePartners.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                      onClick={handleLinkPartner}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={!linkState.partnerId}
                      type="button"
                    >
                      Link
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {canEdit && (
            <>
              <button
                className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddChild();
                }}
                type="button"
              >
                Add child
              </button>
              <button
                className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddPartner();
                }}
                type="button"
              >
                Add partner
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
