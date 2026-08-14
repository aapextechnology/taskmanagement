import type { Actor } from "@/lib/permissions";

// The pure half of event visibility (Owner 2026-08-11), kept apart from the
// queries so it can be tested without a database — the same split as
// bottleneck-math.ts and dataroom/access.ts.

/** Leadership sees the whole portfolio; that is the point of the role. */
export function seesAllEvents(actor: Actor): boolean {
  return actor.role === "owner" || actor.role === "admin";
}

/** Externals never reach the events index; they have their own surface. */
export function seesNoEvents(actor: Actor): boolean {
  return actor.role === "external";
}

/**
 * `"all"` rather than a list of every id — an admin should not drag a
 * thousand-element IN clause through every query.
 */
export type EventScope = "all" | string[];
