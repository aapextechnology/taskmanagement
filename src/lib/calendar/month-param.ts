// T-081: small helpers for the `?m=YYYY-MM` month navigation used by the
// calendar pages. Kept separate from aggregate.ts so that file stays a pure
// module matching exactly the tested API surface.

import { toWibParts } from "@/lib/tasks/dates";

/** The current year/month in WIB (Asia/Jakarta) — a UTC server at, say,
 * 18:00Z on Dec 31 is already January 1 in WIB. */
export function currentWibMonth(): { year: number; monthIndex: number } {
  const { y, m } = toWibParts(new Date());
  return { year: y, monthIndex: m };
}

export function parseMonthParam(
  param: string | undefined,
): { year: number; monthIndex: number } {
  const match = param ? /^(\d{4})-(\d{2})$/.exec(param) : null;
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) return { year, monthIndex };
  }
  return currentWibMonth();
}

export function formatMonthParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const shifted = new Date(year, monthIndex + delta, 1);
  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
}

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

export function formatMonthLabel(year: number, monthIndex: number): string {
  return MONTH_LABEL_FORMAT.format(new Date(year, monthIndex, 1));
}
