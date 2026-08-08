"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HealthBadge } from "@/components/health-badge";

// Persistent sub-header for the event workspace (Owner 2026-08-07): name +
// phase + day count stay visible across every sub-page (Board, List,
// Calendar, Budget, …) instead of each page hand-rolling its own "← {event}"
// breadcrumb. Hidden on the event ROOT page, which already has a full hero
// (poster, live countdown, phase stepper) — this bar would just duplicate it.
export function EventContextBar({
  eventId,
  name,
  phaseName,
  health,
  showDate,
}: {
  eventId: string;
  name: string;
  phaseName: string;
  health: "on_track" | "at_risk" | "critical";
  showDate: string;
}) {
  const pathname = usePathname();
  // day count computed once client-side (lazy initializer, like the hero
  // Countdown) — a slim bar doesn't need second-by-second ticking
  const [dayLabel] = useState(() => {
    const diffDays = Math.round(
      (new Date(showDate).getTime() - Date.now()) / 86_400_000,
    );
    return diffDays > 0
      ? `${diffDays}d to show`
      : diffDays === 0
        ? "Show day"
        : `${Math.abs(diffDays)}d since show`;
  });

  if (pathname === `/events/${eventId}`) return null;

  return (
    <div className="sticky top-14 z-30 -mx-4 mb-6 flex items-center gap-3 overflow-x-auto border-b bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
      <Link
        href={`/events/${eventId}`}
        className="flex shrink-0 items-center gap-1 text-sm font-medium text-foreground hover:underline"
      >
        <ChevronLeft className="size-4 text-muted-foreground" />
        <span className="max-w-48 truncate sm:max-w-xs">{name}</span>
      </Link>
      <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
      <span className="shrink-0 truncate text-xs text-muted-foreground">
        {phaseName}
      </span>
      <HealthBadge health={health} className="shrink-0" />
      {dayLabel ? (
        <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {dayLabel}
        </span>
      ) : null}
    </div>
  );
}
