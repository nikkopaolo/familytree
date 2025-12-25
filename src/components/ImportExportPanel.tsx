"use client";

import { useRef, useState } from "react";
import { Download, UploadCloud } from "lucide-react";
import type { Person, Relationship } from "@/lib/types";
import { exportPeopleCsv, exportTreeJson, parsePeopleCsv } from "@/lib/importExport";

type ImportExportPanelProps = {
  persons: Person[];
  relationships: Relationship[];
  onImportCsv: (rows: Array<Record<string, string>>) => void;
  onImportJson: (payload: { persons: Person[]; relationships: Relationship[] }) => void;
};

export const ImportExportPanel = ({
  persons,
  relationships,
  onImportCsv,
  onImportJson,
}: ImportExportPanelProps) => {
  const [message, setMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportCsv = () => {
    const csv = exportPeopleCsv(persons);
    downloadFile(csv, "family-members.csv", "text/csv");
  };

  const handleExportJson = () => {
    const json = exportTreeJson(persons, relationships);
    downloadFile(json, "family-tree.json", "application/json");
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const parsed = JSON.parse(text);
        onImportJson(parsed);
        setMessage("Tree JSON imported. Relationships preserved.");
      } catch (error) {
        setMessage("Invalid JSON file.");
      }
      return;
    }
    if (file.name.endsWith(".csv")) {
      const rows = parsePeopleCsv(text);
      onImportCsv(rows);
      setMessage("CSV imported. New members added as standalone branches.");
      return;
    }
    setMessage("Unsupported file format. Use CSV or JSON.");
  };

  return (
    <section className="glass-card rounded-3xl p-6">
      <h3 className="text-xl text-slate-900">Import & Export</h3>
      <p className="text-sm text-slate-600">
        Export CSV for member lists or JSON for a full tree backup. Import supports both.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          onClick={handleExportCsv}
        >
          <Download size={14} />
          Export CSV
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white"
          onClick={handleExportJson}
        >
          <Download size={14} />
          Export JSON
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={14} />
          Import File
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".csv,.json"
          onChange={handleImport}
        />
      </div>
      {message && <p className="mt-3 text-xs text-slate-500">{message}</p>}
    </section>
  );
};

const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
