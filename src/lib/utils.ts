import { format, differenceInYears, parseISO, isValid } from "date-fns";

export const parseDateValue = (value?: string) => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = parseISO(raw);
    return isValid(parsed) ? parsed : null;
  }
  if (/^\d{4}$/.test(raw)) {
    const parsed = parseISO(`${raw}-01-01`);
    return isValid(parsed) ? parsed : null;
  }
  const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      const normalized = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const parsed = parseISO(normalized);
      return isValid(parsed) ? parsed : null;
    }
  }
  const parsed = parseISO(raw);
  return isValid(parsed) ? parsed : null;
};

export const formatDate = (value?: string) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, "MMM d, yyyy") : "Unknown";
};

export const formatYear = (value?: string) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, "yyyy") : "Unknown";
};

export const calculateAge = (birthDate?: string, endDate?: string) => {
  if (!birthDate) {
    return "Unknown";
  }
  const birth = parseDateValue(birthDate);
  if (!birth) {
    return "Unknown";
  }
  const end = endDate ? parseDateValue(endDate) : new Date();
  if (!end || !isValid(end)) {
    return "Unknown";
  }
  return `${differenceInYears(end, birth)}`;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());
