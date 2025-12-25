import { DiffItem, Person } from "./types";

export const diffPerson = (before: Person, after: Person): DiffItem[] => {
  const fields: Array<keyof Person> = [
    "fullName",
    "birthDate",
    "deathDate",
    "isAlive",
    "gender",
    "notes",
  ];

  const diffs: DiffItem[] = [];
  fields.forEach((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];
    if (beforeValue !== afterValue) {
      diffs.push({
        field,
        before: beforeValue ? String(beforeValue) : "-",
        after: afterValue ? String(afterValue) : "-",
      });
    }
  });

  if (before.stats?.location !== after.stats?.location) {
    diffs.push({
      field: "location",
      before: before.stats?.location ?? "-",
      after: after.stats?.location ?? "-",
    });
  }

  if (before.photoUrl !== after.photoUrl) {
    diffs.push({
      field: "photoUrl",
      before: before.photoUrl ?? "-",
      after: after.photoUrl ?? "-",
    });
  }

  return diffs;
};
