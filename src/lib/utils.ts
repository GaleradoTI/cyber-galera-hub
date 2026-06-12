import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a "YYYY-MM-DD" date string as a local Date (no timezone shift).
 * Using `new Date("2024-06-28")` treats it as UTC midnight, which renders as
 * the previous day in negative-offset timezones (e.g. America/Sao_Paulo).
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a "YYYY-MM-DD" string with toLocaleDateString without timezone drift. */
export function formatDateOnly(
  value: string | null | undefined,
  locale = "pt-BR",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = parseDateOnly(value);
  return d ? d.toLocaleDateString(locale, options) : "";
}
