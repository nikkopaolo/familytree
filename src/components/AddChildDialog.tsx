"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person } from "@/lib/types";

type AddChildDialogProps = {
  isOpen: boolean;
  parent?: Person;
  partners: Person[];
  onClose: () => void;
  onConfirm: (payload: { fullName: string; partnerIds: string[] }) => void;
};

export const AddChildDialog = ({
  isOpen,
  parent,
  partners,
  onClose,
  onConfirm,
}: AddChildDialogProps) => {
  const [fullName, setFullName] = useState("");
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setFullName("");
    setSelectedPartnerIds(partners.map((partner) => partner.id));
  }, [isOpen, partners]);

  const partnerOptions = useMemo(
    () =>
      [...partners]
        .sort((a, b) =>
          a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
        )
        .map((partner) => ({ id: partner.id, label: partner.fullName })),
    [partners]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="glass-card w-full max-w-md rounded-3xl p-6">
        <h3 className="text-xl text-slate-900">Add child</h3>
        <p className="mt-1 text-sm text-slate-600">
          Create a new child for{" "}
          <span className="font-semibold">{parent?.fullName ?? "this parent"}</span>{" "}
          and optionally link existing partner(s).
        </p>
        <label className="mt-4 block text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Child name
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
            placeholder="New Member"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Link partner(s) as parents
          </p>
          {partnerOptions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No partners linked yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {partnerOptions.map((partner) => {
                const isChecked = selectedPartnerIds.includes(partner.id);
                return (
                  <label
                    key={partner.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <span>{partner.label}</span>
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300"
                      checked={isChecked}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedPartnerIds((prev) =>
                          checked
                            ? [...prev, partner.id]
                            : prev.filter((id) => id !== partner.id)
                        );
                      }}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white"
            onClick={() =>
              onConfirm({
                fullName,
                partnerIds: selectedPartnerIds,
              })
            }
            type="button"
          >
            Add child
          </button>
        </div>
      </div>
    </div>
  );
};
