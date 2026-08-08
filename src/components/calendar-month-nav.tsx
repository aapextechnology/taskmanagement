import Link from "next/link";
import {
  currentWibMonth,
  formatMonthLabel,
  formatMonthParam,
  shiftMonth,
} from "@/lib/calendar/month-param";

// Prev / today / next month controls, monochrome bordered-chip style
// (matches the board-page division tabs).
export function CalendarMonthNav({
  basePath,
  year,
  monthIndex,
}: {
  basePath: string;
  year: number;
  monthIndex: number;
}) {
  const prev = shiftMonth(year, monthIndex, -1);
  const next = shiftMonth(year, monthIndex, 1);
  const today = currentWibMonth();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="min-w-40 text-lg font-semibold tracking-tight">
        {formatMonthLabel(year, monthIndex)}
      </h2>
      <div className="flex items-center gap-1.5">
        <Link
          href={`${basePath}?m=${formatMonthParam(prev.year, prev.monthIndex)}`}
          className="rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← Prev
        </Link>
        <Link
          href={`${basePath}?m=${formatMonthParam(today.year, today.monthIndex)}`}
          className="rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Today
        </Link>
        <Link
          href={`${basePath}?m=${formatMonthParam(next.year, next.monthIndex)}`}
          className="rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
