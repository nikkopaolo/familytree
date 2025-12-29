"use client";

import { useRef, useState } from "react";
import { Download, UploadCloud } from "lucide-react";
import type { Person, Relationship } from "@/lib/types";
import {
  exportGedcom,
  exportPeopleCsv,
  exportTreeJson,
  parseGedcom,
  parsePeopleCsv,
} from "@/lib/importExport";

type ImportExportPanelProps = {
  persons: Person[];
  relationships: Relationship[];
  onImportCsv: (
    rows: Array<Record<string, string>>
  ) => Promise<{ error?: string }> | { error?: string } | void;
  onImportJson: (
    payload: { persons: Person[]; relationships: Relationship[] }
  ) => Promise<{ error?: string }> | { error?: string } | void;
};

export const ImportExportPanel = ({
  persons,
  relationships,
  onImportCsv,
  onImportJson,
}: ImportExportPanelProps) => {
  const [message, setMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const exportName = (base: string, extension: string) =>
    `${base}-${dateStamp}.${extension}`;

  const handleExportCsv = () => {
    const csv = exportPeopleCsv(persons, relationships);
    downloadFile(csv, exportName("family-members", "csv"), "text/csv");
  };

  const handleExportJson = () => {
    const json = exportTreeJson(persons, relationships);
    downloadFile(json, exportName("family-tree", "json"), "application/json");
  };

  const handleExportGedcom = () => {
    const gedcom = exportGedcom(persons, relationships);
    downloadFile(gedcom, exportName("family-tree", "ged"), "text/plain");
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const parsed = JSON.parse(text);
        const result = await onImportJson(parsed);
        if (result && result.error) {
          setMessage(result.error);
          return;
        }
        setMessage("Tree JSON imported. Relationships preserved.");
      } catch (error) {
        setMessage("Invalid JSON file.");
      }
      return;
    }
    if (file.name.endsWith(".csv")) {
      const rows = parsePeopleCsv(text);
      const result = await onImportCsv(rows);
      if (result && result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("CSV imported. Relationships linked when data is available.");
      return;
    }
    if (file.name.endsWith(".ged") || file.name.endsWith(".gedcom")) {
      const parsed = parseGedcom(text);
      const result = await onImportJson(parsed);
      if (result && result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("GEDCOM imported. Relationships preserved.");
      return;
    }
    setMessage("Unsupported file format. Use CSV, JSON, or GEDCOM.");
  };

  return (
    <section className="glass-card rounded-3xl p-6">
      <h3 className="text-xl text-slate-900">Import & Export</h3>
      <p className="text-sm text-slate-600">
        Export CSV for member lists with relationships, JSON for a full tree backup, or GEDCOM
        for genealogy tools. Import supports all three formats.
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
          onClick={handleExportGedcom}
        >
          <Download size={14} />
          Export GEDCOM
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
          accept=".csv,.json,.ged,.gedcom"
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
