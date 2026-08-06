import type { Actor } from "@/lib/permissions";

// Pure scoping rules for global search (T-102) — extracted so the
// role-visibility matrix is unit-testable without a database.

/** null = no restriction (sees every division); [] = sees nothing */
export function visibleDivisionsFor(actor: Actor): string[] | null {
  if (actor.role === "external") return [];
  if (actor.role === "owner" || actor.role === "admin") return null;
  return actor.memberships.map((m) => m.divisionId);
}

/** Externals never touch internal search; everyone else may. */
export function canSearch(actor: Actor): boolean {
  return actor.role !== "external";
}
