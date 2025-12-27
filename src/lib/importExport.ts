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

const resolveLocation = (person: Person) =>
  person.stats?.location ?? (person as { location?: string }).location ?? "";

const resolveStats = (person: Person) => {
  const fallback = person as { location?: string; occupation?: string };
  const base = person.stats ?? {};
  return {
    ...base,
    ...(fallback.location !== undefined ? { location: fallback.location } : {}),
    ...(fallback.occupation !== undefined ? { occupation: fallback.occupation } : {}),
  };
};

const resolveIsAlive = (person: Person) => (person.deathDate ? false : person.isAlive);

export const exportPeopleCsv = (persons: Person[]) => {
  const rows = persons.map((person) => [
    person.fullName,
    person.birthDate ?? "",
    person.deathDate ?? "",
    resolveIsAlive(person) ? "true" : "false",
    person.gender ?? "",
    resolveLocation(person),
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
      persons: persons.map((person) => ({
        ...person,
        isAlive: resolveIsAlive(person),
        stats: resolveStats(person),
      })),
      relationships,
    },
    null,
    2
  );
};

const months = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const formatGedcomDate = (value?: string) => {
  if (!value) return "";
  const exactMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactMatch) {
    const [, year, month, day] = exactMatch;
    const monthIndex = Number(month) - 1;
    const monthLabel = months[monthIndex] ?? "JAN";
    return `${Number(day)} ${monthLabel} ${year}`;
  }
  const yearOnly = value.match(/^(\d{4})$/);
  if (yearOnly) {
    return yearOnly[1];
  }
  return value;
};

const parseGedcomDate = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  const parts = trimmed.split(" ");
  if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
    return parts[0];
  }
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, "0");
    const monthIndex = months.indexOf(parts[1].toUpperCase());
    const year = parts[2];
    if (monthIndex >= 0 && /^\d{4}$/.test(year)) {
      const month = String(monthIndex + 1).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  return undefined;
};

const normalizeName = (value: string) => {
  const trimmed = value.replace(/\//g, "").trim();
  if (!trimmed) return "Unknown";
  return trimmed;
};

const formatGedcomName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return `${fullName.trim()} /`;
  }
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(" ");
  return `${given} /${surname}/`;
};

export const exportGedcom = (persons: Person[], relationships: Relationship[]) => {
  const personIdMap = new Map<string, string>();
  persons.forEach((person, index) => {
    personIdMap.set(person.id, `I${index + 1}`);
  });

  const parentLinks = relationships.filter((rel) => rel.relationshipType === "parent");
  const partnerLinks = relationships.filter((rel) => rel.relationshipType === "partner");

  const parentsByChild = new Map<string, string[]>();
  parentLinks.forEach((rel) => {
    const list = parentsByChild.get(rel.childId) ?? [];
    list.push(rel.parentId);
    parentsByChild.set(rel.childId, list);
  });

  const normalizePair = (left: string, right: string) =>
    left < right ? `${left}|${right}` : `${right}|${left}`;
  const partnerPairs = new Set<string>();
  partnerLinks.forEach((rel) => partnerPairs.add(normalizePair(rel.parentId, rel.childId)));

  const familyMap = new Map<
    string,
    { parents: string[]; children: Set<string> }
  >();

  partnerPairs.forEach((pairKey) => {
    const [parentA, parentB] = pairKey.split("|");
    familyMap.set(pairKey, { parents: [parentA, parentB], children: new Set() });
  });

  parentsByChild.forEach((parentIds, childId) => {
    let selectedParents: string[] = [];
    if (parentIds.length >= 2) {
      let matched: [string, string] | null = null;
      for (let i = 0; i < parentIds.length && !matched; i += 1) {
        for (let j = i + 1; j < parentIds.length; j += 1) {
          const key = normalizePair(parentIds[i], parentIds[j]);
          if (partnerPairs.has(key)) {
            matched = [parentIds[i], parentIds[j]];
            break;
          }
        }
      }
      selectedParents = matched ?? parentIds.slice(0, 2);
    } else if (parentIds.length === 1) {
      selectedParents = [parentIds[0]];
    }
    if (selectedParents.length === 0) return;
    const key = selectedParents.length === 2
      ? normalizePair(selectedParents[0], selectedParents[1])
      : `${selectedParents[0]}|`;
    const entry = familyMap.get(key) ?? {
      parents: selectedParents,
      children: new Set(),
    };
    entry.children.add(childId);
    familyMap.set(key, entry);
  });

  const familyIds = new Map<string, string>();
  Array.from(familyMap.keys()).forEach((key, index) => {
    familyIds.set(key, `F${index + 1}`);
  });

  const lines: string[] = [];
  lines.push("0 HEAD");
  lines.push("1 SOUR FAMTREE");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("1 CHAR UTF-8");

  persons.forEach((person) => {
    const indiId = personIdMap.get(person.id);
    if (!indiId) return;
    lines.push(`0 @${indiId}@ INDI`);
    lines.push(`1 NAME ${formatGedcomName(person.fullName)}`);
    const sex = person.gender?.toLowerCase().startsWith("f")
      ? "F"
      : person.gender?.toLowerCase().startsWith("m")
        ? "M"
        : "U";
    lines.push(`1 SEX ${sex}`);
    const birthDate = formatGedcomDate(person.birthDate);
    if (birthDate) {
      lines.push("1 BIRT");
      lines.push(`2 DATE ${birthDate}`);
    }
    const deathDate = formatGedcomDate(person.deathDate);
    if (deathDate) {
      lines.push("1 DEAT");
      lines.push(`2 DATE ${deathDate}`);
    }
  });

  familyMap.forEach((family, key) => {
    const famId = familyIds.get(key);
    if (!famId) return;
    lines.push(`0 @${famId}@ FAM`);
    const parents = family.parents;
    if (parents.length > 0) {
      const person = persons.find((item) => item.id === parents[0]);
      const personId = person ? personIdMap.get(person.id) : undefined;
      const gender = person?.gender?.toLowerCase() ?? "";
      if (personId) {
        lines.push(`1 ${gender.startsWith("f") ? "WIFE" : "HUSB"} @${personId}@`);
      }
    }
    if (parents.length > 1) {
      const person = persons.find((item) => item.id === parents[1]);
      const personId = person ? personIdMap.get(person.id) : undefined;
      const gender = person?.gender?.toLowerCase() ?? "";
      if (personId) {
        lines.push(`1 ${gender.startsWith("m") ? "HUSB" : "WIFE"} @${personId}@`);
      }
    }
    family.children.forEach((childId) => {
      const childGedId = personIdMap.get(childId);
      if (childGedId) {
        lines.push(`1 CHIL @${childGedId}@`);
      }
    });
  });

  lines.push("0 TRLR");
  return lines.join("\n");
};

export const parseGedcom = (gedcom: string) => {
  const lines = gedcom.split(/\r?\n/);
  const individuals = new Map<
    string,
    {
      id: string;
      fullName: string;
      gender?: string;
      birthDate?: string;
      deathDate?: string;
    }
  >();
  const families = new Map<
    string,
    { id: string; husb?: string; wife?: string; children: string[] }
  >();

  let currentIndi: string | null = null;
  let currentFam: string | null = null;
  let activeDateType: "birth" | "death" | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(" ");
    const level = Number(parts[0]);
    if (Number.isNaN(level)) return;
    if (level === 0) {
      currentIndi = null;
      currentFam = null;
      activeDateType = null;
      if (parts[1]?.startsWith("@") && parts[2] === "INDI") {
        currentIndi = parts[1].replace(/@/g, "");
        individuals.set(currentIndi, {
          id: currentIndi,
          fullName: "Unknown",
        });
      }
      if (parts[1]?.startsWith("@") && parts[2] === "FAM") {
        currentFam = parts[1].replace(/@/g, "");
        families.set(currentFam, {
          id: currentFam,
          children: [],
        });
      }
      return;
    }

    const tag = parts[1];
    const value = parts.slice(2).join(" ");

    if (currentIndi) {
      const indi = individuals.get(currentIndi);
      if (!indi) return;
      if (tag === "NAME") {
        indi.fullName = normalizeName(value);
      } else if (tag === "SEX") {
        indi.gender = value === "F" ? "Female" : value === "M" ? "Male" : undefined;
      } else if (tag === "BIRT") {
        activeDateType = "birth";
      } else if (tag === "DEAT") {
        activeDateType = "death";
      } else if (tag === "DATE") {
        const parsed = parseGedcomDate(value);
        if (activeDateType === "birth") indi.birthDate = parsed;
        if (activeDateType === "death") indi.deathDate = parsed;
      }
    }

    if (currentFam) {
      const fam = families.get(currentFam);
      if (!fam) return;
      if (tag === "HUSB") {
        fam.husb = value.replace(/@/g, "");
      } else if (tag === "WIFE") {
        fam.wife = value.replace(/@/g, "");
      } else if (tag === "CHIL") {
        fam.children.push(value.replace(/@/g, ""));
      }
    }
  });

  const gedcomIdToPersonId = new Map<string, string>();
  const persons: Person[] = Array.from(individuals.values()).map((indi) => {
    const id = crypto.randomUUID();
    gedcomIdToPersonId.set(indi.id, id);
    return {
      id,
      clanId: "",
      branchRootId: id,
      fullName: indi.fullName,
      birthDate: indi.birthDate,
      deathDate: indi.deathDate,
      isAlive: !indi.deathDate,
      gender: indi.gender,
      createdAt: new Date().toISOString(),
    };
  });

  const relationships: Relationship[] = [];
  Array.from(families.values()).forEach((fam) => {
    const husbId = fam.husb ? gedcomIdToPersonId.get(fam.husb) : undefined;
    const wifeId = fam.wife ? gedcomIdToPersonId.get(fam.wife) : undefined;
    if (husbId && wifeId) {
      relationships.push({
        id: crypto.randomUUID(),
        clanId: "",
        parentId: husbId,
        childId: wifeId,
        relationshipType: "partner",
      });
    }
    fam.children.forEach((childGedId) => {
      const childId = gedcomIdToPersonId.get(childGedId);
      if (!childId) return;
      if (husbId) {
        relationships.push({
          id: crypto.randomUUID(),
          clanId: "",
          parentId: husbId,
          childId,
          relationshipType: "parent",
        });
      }
      if (wifeId) {
        relationships.push({
          id: crypto.randomUUID(),
          clanId: "",
          parentId: wifeId,
          childId,
          relationshipType: "parent",
        });
      }
    });
  });

  return { persons, relationships };
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
