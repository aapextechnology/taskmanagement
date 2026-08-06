// Pure date helpers for tasks (T-033/T-035) — WIB (UTC+7, no DST).

export const WIB_OFFSET_MINUTES = 7 * 60;

export type DueBucket = "overdue" | "today" | "this_week" | "later" | "none";

function toWibParts(date: Date): { y: number; m: number; d: number; dow: number } {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MINUTES * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(), // 0 = Sunday
  };
}

/** midnight WIB of the given instant's WIB calendar day, as a UTC Date */
function wibDayStart(date: Date): Date {
  const p = toWibParts(date);
  return new Date(Date.UTC(p.y, p.m, p.d) - WIB_OFFSET_MINUTES * 60_000);
}

export function bucketForDue(due: Date | null, now: Date): DueBucket {
  if (!due) return "none";
  if (due.getTime() < now.getTime()) return "overdue";

  const todayStart = wibDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  if (due < tomorrowStart) return "today";

  // rest of the current WIB week (Monday-based)
  const { dow } = toWibParts(now);
  const daysLeftInWeek = dow === 0 ? 1 : 8 - dow; // days until next Monday
  const weekEnd = new Date(todayStart.getTime() + daysLeftInWeek * 86_400_000);
  if (due < weekEnd) return "this_week";

  return "later";
}

export type RecurrenceRule = "none" | "daily" | "weekly" | "monthly";

export function nextRecurrenceDate(
  from: Date,
  rule: RecurrenceRule,
): Date | null {
  switch (rule) {
    case "daily":
      return new Date(from.getTime() + 86_400_000);
    case "weekly":
      return new Date(from.getTime() + 7 * 86_400_000);
    case "monthly": {
      const next = new Date(from.getTime());
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    }
    case "none":
      return null;
  }
}
