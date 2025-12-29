"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Send } from "lucide-react";
import type { Person, Relationship } from "@/lib/types";
import { calculateAge, formatDate } from "@/lib/utils";

type PersonDetailsProps = {
  person?: Person;
  persons: Person[];
  relationships: Relationship[];
  canEdit: boolean;
  onSubmitUpdate: (payload: Record<string, unknown>) => void;
  onAddParentChild: (parentId: string, childId: string) => void;
  onAddPartner: (
    personId: string,
    partnerId: string,
    marriageDate?: string | null
  ) => void;
  onUpdateRelationship: (relationshipId: string, payload: Record<string, unknown>) => void;
  onDeleteRelationship?: (relationshipId: string) => void;
  onDelete?: (personId: string) => void;
  canUploadPhoto?: boolean;
  onUploadPhoto?: (file: File) => Promise<{ error?: string }>;
};

export const PersonDetails = ({
  person,
  persons,
  relationships,
  canEdit,
  onSubmitUpdate,
  onAddParentChild,
  onAddPartner,
  onUpdateRelationship,
  onDeleteRelationship,
  onDelete,
  canUploadPhoto = false,
  onUploadPhoto,
}: PersonDetailsProps) => {
  const [photoMessage, setPhotoMessage] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedPartnerMarriageDate, setSelectedPartnerMarriageDate] = useState("");
  const [partnerDateDrafts, setPartnerDateDrafts] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState({
    fullName: "",
    isAlive: true,
    notes: "",
    location: "",
    occupation: "",
    birthDate: "",
    deathDate: "",
    gender: "",
  });
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const personId = person?.id ?? "";

  const relationshipSummary = useMemo(() => {
    const sortByName = (a: Person, b: Person) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
    const isPerson = (value: Person | undefined): value is Person => Boolean(value);
    if (!personId) {
      return {
        parents: [] as Array<{ person: Person; relationship: Relationship }>,
        children: [] as Array<{ person: Person; relationship: Relationship }>,
        partners: [] as Array<{ person: Person; relationship: Relationship }>,
        siblings: [] as Person[],
        auntsUncles: [] as Person[],
        niecesNephews: [] as Person[],
        eligibleParents: [] as Person[],
        eligibleChildren: [] as Person[],
        eligiblePartners: [] as Person[],
      };
    }

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
      .map((rel) => {
        const parent = persons.find((p) => p.id === rel.parentId);
        if (!parent) return null;
        return { person: parent, relationship: rel };
      })
      .filter(
        (value): value is { person: Person; relationship: Relationship } => Boolean(value)
      )
      .sort((a, b) => sortByName(a.person, b.person));
    const children = childLinks
      .map((rel) => {
        const child = persons.find((p) => p.id === rel.childId);
        if (!child) return null;
        return { person: child, relationship: rel };
      })
      .filter(
        (value): value is { person: Person; relationship: Relationship } => Boolean(value)
      )
      .sort((a, b) => sortByName(a.person, b.person));
    const partners = partnerLinks
      .map((rel) => {
        const partner = persons.find(
          (p) => p.id === (rel.parentId === personId ? rel.childId : rel.parentId)
        );
        if (!partner) return null;
        return { person: partner, relationship: rel };
      })
      .filter(
        (
          value
        ): value is { person: Person; relationship: Relationship } => Boolean(value)
      )
      .sort((a, b) => sortByName(a.person, b.person));

    const parentIdSet = new Set(parentLinks.map((rel) => rel.parentId));
    const childIdSet = new Set(childLinks.map((rel) => rel.childId));
    const partnerIdSet = new Set(
      partnerLinks.map((rel) => (rel.parentId === personId ? rel.childId : rel.parentId))
    );

    const eligibleParents = persons
      .filter((p) => p.id !== personId && !parentIdSet.has(p.id))
      .sort(sortByName);
    const eligibleChildren = persons
      .filter((p) => p.id !== personId && !childIdSet.has(p.id))
      .sort(sortByName);
    const eligiblePartners = persons
      .filter((p) => p.id !== personId && !partnerIdSet.has(p.id))
      .sort(sortByName);

    const siblingIds = new Set(
      relationships
        .filter(
          (rel) => rel.relationshipType === "parent" && parentIdSet.has(rel.parentId)
        )
        .map((rel) => rel.childId)
    );
    siblingIds.delete(personId);

    const siblings = Array.from(siblingIds)
      .map((id) => persons.find((p) => p.id === id))
      .filter(isPerson)
      .sort(sortByName);

    const grandparentIds = new Set(
      relationships
        .filter(
          (rel) => rel.relationshipType === "parent" && parentIdSet.has(rel.childId)
        )
        .map((rel) => rel.parentId)
    );

    const auntUncleIds = new Set(
      relationships
        .filter(
          (rel) => rel.relationshipType === "parent" && grandparentIds.has(rel.parentId)
        )
        .map((rel) => rel.childId)
    );
    parentIdSet.forEach((id) => auntUncleIds.delete(id));
    auntUncleIds.delete(personId);

    const auntsUncles = Array.from(auntUncleIds)
      .map((id) => persons.find((p) => p.id === id))
      .filter(isPerson)
      .sort(sortByName);

    const nieceNephewIds = new Set(
      relationships
        .filter(
          (rel) => rel.relationshipType === "parent" && siblingIds.has(rel.parentId)
        )
        .map((rel) => rel.childId)
    );

    const niecesNephews = Array.from(nieceNephewIds)
      .map((id) => persons.find((p) => p.id === id))
      .filter(isPerson)
      .sort(sortByName);

    return {
      parents,
      children,
      partners,
      siblings,
      auntsUncles,
      niecesNephews,
      eligibleParents,
      eligibleChildren,
      eligiblePartners,
    };
  }, [personId, persons, relationships]);

  useEffect(() => {
    if (!person) return;
    setFormState({
      fullName: person.fullName,
      isAlive: person.isAlive,
      notes: person.notes ?? "",
      location: person.stats?.location ?? "",
      occupation: person.stats?.occupation ?? "",
      birthDate: person.birthDate ?? "",
      deathDate: person.deathDate ?? "",
      gender: person.gender ?? "",
    });
    setSelectedParentId("");
    setSelectedChildId("");
    setSelectedPartnerId("");
    setSelectedPartnerMarriageDate("");
  }, [person]);

  useEffect(() => {
    if (!personId) return;
    const drafts: Record<string, string> = {};
    relationships
      .filter(
        (rel) =>
          rel.relationshipType === "partner" &&
          (rel.parentId === personId || rel.childId === personId)
      )
      .forEach((rel) => {
        drafts[rel.id] = rel.marriageDate ?? "";
      });
    setPartnerDateDrafts(drafts);
  }, [personId, relationships]);


  if (!person) {
    return (
      <aside className="glass-card rounded-3xl p-6">
        <h3 className="text-xl text-slate-900">Member Profile</h3>
        <p className="text-sm text-slate-600">Select a member to view details.</p>
      </aside>
    );
  }

  const handleSubmit = () => {
    const payload = {
      fullName: formState.fullName,
      isAlive: formState.isAlive,
      notes: formState.notes,
      birthDate: formState.birthDate || null,
      deathDate: formState.isAlive ? null : formState.deathDate || null,
      gender: formState.gender || null,
      stats: {
        ...(person.stats ?? {}),
        location: formState.location,
        occupation: formState.occupation,
      },
    };
    onSubmitUpdate(payload);
  };

  const handleReset = () => {
    if (!person) return;
    setFormState({
      fullName: person.fullName,
      isAlive: person.isAlive,
      notes: person.notes ?? "",
      location: person.stats?.location ?? "",
      occupation: person.stats?.occupation ?? "",
      birthDate: person.birthDate ?? "",
      deathDate: person.deathDate ?? "",
      gender: person.gender ?? "",
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadPhoto) return;
    setPhotoMessage("Uploading photo...");
    const result = await onUploadPhoto(file);
    if (result.error) {
      setPhotoMessage(result.error);
    } else {
      setPhotoMessage("Photo updated.");
    }
    event.target.value = "";
  };

  const addParent = () => {
    if (!selectedParentId) return;
    onAddParentChild(selectedParentId, personId);
    setSelectedParentId("");
  };

  const addChild = () => {
    if (!selectedChildId) return;
    onAddParentChild(personId, selectedChildId);
    setSelectedChildId("");
  };

  const addPartner = () => {
    if (!selectedPartnerId) return;
    onAddPartner(personId, selectedPartnerId, selectedPartnerMarriageDate || null);
    setSelectedPartnerId("");
    setSelectedPartnerMarriageDate("");
  };

  const isDirty = Boolean(
    person &&
      (formState.fullName !== person.fullName ||
        formState.birthDate !== (person.birthDate ?? "") ||
        formState.isAlive !== person.isAlive ||
        (formState.isAlive ? "" : formState.deathDate) !== (person.deathDate ?? "") ||
        formState.gender !== (person.gender ?? "") ||
        formState.location !== (person.stats?.location ?? "") ||
        formState.occupation !== (person.stats?.occupation ?? "") ||
        formState.notes !== (person.notes ?? ""))
  );

  return (
    <aside className="glass-card rounded-3xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {canEdit ? (
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xl font-semibold text-slate-900"
              value={formState.fullName}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, fullName: event.target.value }))
              }
            />
          ) : (
            <h3 className="text-xl text-slate-900">{person.fullName}</h3>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {formState.isAlive ? "Alive" : "Deceased"} - Age{" "}
            {calculateAge(person.birthDate, person.deathDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
                onClick={handleReset}
                disabled={!isDirty}
                type="button"
              >
                Reset
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                onClick={handleSubmit}
                disabled={!isDirty}
                type="button"
              >
                <Send size={14} />
                Save
              </button>
            </>
          )}
          {canEdit && onDelete && (
            <button
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete ${person.fullName}? This will remove all linked relationships.`
                );
                if (confirmed) {
                  onDelete(person.id);
                }
              }}
              type="button"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {person.photoUrl ? (
                <Image
                  src={person.photoUrl}
                  alt={person.fullName}
                  width={80}
                  height={80}
                  className="size-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex size-full items-center justify-center text-xs font-semibold text-slate-400">
                  No photo
                </div>
              )}
            </div>
            <div>
              <button
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${
                  canUploadPhoto
                    ? "bg-amber-500 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
                onClick={() => canUploadPhoto && photoInputRef.current?.click()}
              >
                <Camera size={14} />
                Upload photo
              </button>
              {photoMessage && <p className="mt-2 text-xs text-slate-500">{photoMessage}</p>}
              {!canUploadPhoto && (
                <p className="mt-2 text-xs text-slate-500">
                  Sign in with branch access to upload photos.
                </p>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Birthday</span>
              {canEdit ? (
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={formState.birthDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, birthDate: event.target.value }))
                  }
                />
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(person.birthDate)}
                </p>
              )}
            </label>
            {!formState.isAlive && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Deceased date</span>
                {canEdit ? (
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={formState.deathDate}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, deathDate: event.target.value }))
                    }
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(person.deathDate)}
                  </p>
                )}
              </label>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Status</span>
              {canEdit ? (
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={formState.isAlive ? "alive" : "deceased"}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      isAlive: event.target.value === "alive",
                      deathDate: event.target.value === "alive" ? "" : prev.deathDate,
                    }))
                  }
                >
                  <option value="alive">Alive</option>
                  <option value="deceased">Deceased</option>
                </select>
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {person.isAlive ? "Alive" : "Deceased"}
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Gender</span>
              {canEdit ? (
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={formState.gender}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, gender: event.target.value }))
                  }
                >
                  <option value="">Unspecified</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {person.gender ?? "Unknown"}
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Location</span>
              {canEdit ? (
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={formState.location}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {person.stats?.location ?? "Unknown"}
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Occupation</span>
              {canEdit ? (
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={formState.occupation}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, occupation: event.target.value }))
                  }
                />
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {person.stats?.occupation ?? "Unknown"}
                </p>
              )}
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Notes</span>
              {canEdit ? (
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {person.notes ?? "No notes yet."}
                </p>
              )}
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Relationships
          </p>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div>
              <span className="text-xs font-semibold text-slate-500">Partners</span>
              <div className="mt-1">
                {relationshipSummary.partners.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {relationshipSummary.partners.map((entry) => {
                      const dateValue =
                        partnerDateDrafts[entry.relationship.id] ??
                        entry.relationship.marriageDate ??
                        "";
                      return (
                        <li key={entry.relationship.id} className="text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-800">
                              {entry.person.fullName}
                            </span>
                            <span className="text-xs text-slate-500">
                              {entry.relationship.marriageDate
                                ? `Married ${formatDate(entry.relationship.marriageDate)}`
                                : "Marriage date unknown"}
                            </span>
                          </div>
                          {canEdit && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <input
                                type="date"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                                value={dateValue}
                                onChange={(event) =>
                                  setPartnerDateDrafts((prev) => ({
                                    ...prev,
                                    [entry.relationship.id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                onClick={() =>
                                  onUpdateRelationship(entry.relationship.id, {
                                    marriageDate: dateValue || null,
                                  })
                                }
                                disabled={
                                  dateValue === (entry.relationship.marriageDate ?? "")
                                }
                                type="button"
                              >
                                Save
                              </button>
                              {onDeleteRelationship && (
                                <button
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      `Remove ${entry.person.fullName} as partner?`
                                    );
                                    if (confirmed) {
                                      onDeleteRelationship(entry.relationship.id);
                                    }
                                  }}
                                  type="button"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No partners linked yet.</p>
                )}
              </div>
              {canEdit && (
                <div className="mt-2 grid gap-2">
                  <div className="flex gap-2">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={selectedPartnerId}
                      onChange={(event) => setSelectedPartnerId(event.target.value)}
                    >
                      <option value="">Add partner</option>
                      {relationshipSummary.eligiblePartners.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      onClick={addPartner}
                      disabled={!selectedPartnerId}
                      type="button"
                    >
                      Link
                    </button>
                  </div>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Marriage date (optional)"
                    value={selectedPartnerMarriageDate}
                    aria-label="Marriage date (optional)"
                    title="Marriage date (optional)"
                    onChange={(event) => setSelectedPartnerMarriageDate(event.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500">Parents</span>
              <div className="mt-1">
                {relationshipSummary.parents.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {relationshipSummary.parents.map((entry) => (
                      <li key={entry.relationship.id} className="text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <span>{entry.person.fullName}</span>
                          {canEdit && onDeleteRelationship && (
                            <button
                              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
                              onClick={() => {
                                const confirmed = window.confirm(
                                  `Remove ${entry.person.fullName} as parent?`
                                );
                                if (confirmed) {
                                  onDeleteRelationship(entry.relationship.id);
                                }
                              }}
                              type="button"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No parents linked yet.</p>
                )}
              </div>
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={selectedParentId}
                    onChange={(event) => setSelectedParentId(event.target.value)}
                  >
                    <option value="">Add parent</option>
                    {relationshipSummary.eligibleParents.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    onClick={addParent}
                    disabled={!selectedParentId}
                    type="button"
                  >
                    Link
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">Children</span>
              <div className="mt-1">
                {relationshipSummary.children.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {relationshipSummary.children.map((entry) => (
                      <li key={entry.relationship.id} className="text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <span>{entry.person.fullName}</span>
                          {canEdit && onDeleteRelationship && (
                            <button
                              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
                              onClick={() => {
                                const confirmed = window.confirm(
                                  `Remove ${entry.person.fullName} as child?`
                                );
                                if (confirmed) {
                                  onDeleteRelationship(entry.relationship.id);
                                }
                              }}
                              type="button"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No children linked yet.</p>
                )}
              </div>
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={selectedChildId}
                    onChange={(event) => setSelectedChildId(event.target.value)}
                  >
                    <option value="">Add child</option>
                    {relationshipSummary.eligibleChildren.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    onClick={addChild}
                    disabled={!selectedChildId}
                    type="button"
                  >
                    Link
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">Derived</span>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Siblings</span>
                  {relationshipSummary.siblings.length > 0 ? (
                    <p className="mt-1 text-sm text-slate-700">
                      {relationshipSummary.siblings.map((item) => item.fullName).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No siblings detected.</p>
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Aunts / Uncles</span>
                  {relationshipSummary.auntsUncles.length > 0 ? (
                    <p className="mt-1 text-sm text-slate-700">
                      {relationshipSummary.auntsUncles
                        .map((item) => item.fullName)
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No aunts or uncles detected.</p>
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Nieces / Nephews</span>
                  {relationshipSummary.niecesNephews.length > 0 ? (
                    <p className="mt-1 text-sm text-slate-700">
                      {relationshipSummary.niecesNephews
                        .map((item) => item.fullName)
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No nieces or nephews detected.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </aside>
  );
};
