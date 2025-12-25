import { format, differenceInYears, parseISO, isValid } from "date-fns";

export const formatDate = (value?: string) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return "Unknown";
  }
  return format(parsed, "MMM d, yyyy");
};

export const formatYear = (value?: string) => {
  if (!value) {
    return "Unknown";
  }
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return "Unknown";
  }
  return format(parsed, "yyyy");
};

export const calculateAge = (birthDate?: string, endDate?: string) => {
  if (!birthDate) {
    return "Unknown";
  }
  const birth = parseISO(birthDate);
  if (!isValid(birth)) {
    return "Unknown";
  }
  const end = endDate ? parseISO(endDate) : new Date();
  if (!isValid(end)) {
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
