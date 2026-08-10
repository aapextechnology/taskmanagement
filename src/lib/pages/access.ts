// Access rules for standalone pages (EPIC-016 T-160). Pure and DB-free so
// every branch is unit-tested — this is the module that decides whether one
// person's private notes are visible to another.
//
// Owner decision 2026-08-10: pages start PRIVATE to their author and are
// shared explicitly. Two consequences worth stating out loud:
//
//  * A global owner/admin does NOT get automatic sight of a private page.
//    "Private" that leadership can read anyway is not private, and these
//    pages hold assistant summaries of uploaded documents. Governance access
//    would be a separate, logged, deliberate feature.
//  * External/guest accounts never reach any page, shared or not.

export type PageVisibility = "private" | "organisation";

export interface PageAccessSubject {
  id: string;
  role: string;
  memberships: ReadonlyArray<{ divisionId: string }>;
}

export interface PageAccessTarget {
  ownerId: string;
  visibility: PageVisibility;
}

export interface PageShareRow {
  userId: string | null;
  divisionId: string | null;
  canEdit: boolean;
}

export interface PageAccess {
  /** may open and read the page */
  canView: boolean;
  /** may change the title and body */
  canEdit: boolean;
  /** may share, change visibility, and delete — author only */
  canManage: boolean;
}

const NONE: PageAccess = { canView: false, canEdit: false, canManage: false };

export function resolvePageAccess(
  actor: PageAccessSubject,
  page: PageAccessTarget,
  shares: readonly PageShareRow[],
): PageAccess {
  // externals live in the guest portal and never see workspace pages
  if (actor.role === "external") return NONE;

  if (page.ownerId === actor.id) {
    return { canView: true, canEdit: true, canManage: true };
  }

  const divisions = new Set(actor.memberships.map((m) => m.divisionId));
  // a person can match several grants (direct + via division); the most
  // permissive one wins
  const matching = shares.filter(
    (s) =>
      (s.userId !== null && s.userId === actor.id) ||
      (s.divisionId !== null && divisions.has(s.divisionId)),
  );

  const sharedCanEdit = matching.some((s) => s.canEdit);
  const shared = matching.length > 0;
  const orgWide = page.visibility === "organisation";

  if (!shared && !orgWide) return NONE;

  return {
    canView: true,
    // org-wide visibility grants reading only — writing still needs an
    // explicit grant, so a shared SOP cannot be silently rewritten
    canEdit: sharedCanEdit,
    canManage: false,
  };
}
