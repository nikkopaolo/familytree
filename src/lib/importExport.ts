import type { Person, Relationship } from "./types";

const csvHeaders = [
  "full_name",
  "birth_date",
  "death_date",
  "is_alive",
  "gender",
  "location",
  "photo_url",
  "notes",
];

export const exportPeopleCsv = (persons: Person[]) => {
  const rows = persons.map((person) => [
    person.fullName,
    person.birthDate ?? "",
    person.deathDate ?? "",
    person.isAlive ? "true" : "false",
    person.gender ?? "",
    person.stats?.location ?? "",
    person.photoUrl ?? "",
    person.notes?.replace(/\n/g, " ") ?? "",
  ]);

  return [csvHeaders.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");
};

const escapeCsv = (value: string) => {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const exportTreeJson = (persons: Person[], relationships: Relationship[]) => {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      persons,
      relationships,
    },
    null,
    2
  );
};

export const parsePeopleCsv = (csv: string) => {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const [header, ...rows] = lines;
  if (!header) return [];
  const columns = header.split(",").map((item) => item.trim());
  return rows.map((row) => {
    const values = splitCsvRow(row);
    const data: Record<string, string> = {};
    columns.forEach((key, index) => {
      data[key] = values[index] ?? "";
    });
    return data;
  });
};

const splitCsvRow = (row: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"' && row[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
};
