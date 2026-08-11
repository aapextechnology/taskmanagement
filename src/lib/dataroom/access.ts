// Who may see a dataroom folder (EPIC-017 T-171).
//
// Pure — no database, no session — because this is the module that decides
// whether one department's contract is visible to another. Every branch is
// unit-tested; the service layer only feeds it rows.
//
// Four levels, from tightest to widest. "Public" here always means inside
// the installation: reaching anyone outside is a separate mechanism (signed
// links, EPIC-018) and is never a side effect of this setting.

export type Visibility = "sealed" | "division" | "event" | "organisation";

/** Tightest first. Used for the narrow-only rule below. */
const WIDTH: Record<Visibility, number> = {
  sealed: 0,
  division: 1,
  event: 2,
  organisation: 3,
};

export const DEFAULT_VISIBILITY: Visibility = "event";

/**
 * A sub-folder may only narrow, never widen. Without this an
 * `organisation` folder nested inside a `sealed` one leaks its contents while
 * the person who created it believes the sealed parent protects it.
 */
export function canNest(parent: Visibility, child: Visibility): boolean {
  return WIDTH[child] <= WIDTH[parent];
}

/** The widest a child may be, for populating the UI's options. */
export function allowedChildLevels(parent: Visibility): Visibility[] {
  return (Object.keys(WIDTH) as Visibility[]).filter((v) => canNest(parent, v));
}

export interface AccessSubject {
  id: string;
  role: "owner" | "admin" | "member" | "external";
  /** divisions the person belongs to */
  divisionIds: readonly string[];
  /** whether they may view the event this folder belongs to — computed by
   *  the caller from the existing permission module, not re-derived here */
  canViewEvent: boolean;
}

export interface FolderNode {
  id: string;
  visibility: Visibility;
  /** required when visibility is "division" */
  divisionId: string | null;
  createdBy: string | null;
  /** explicit grants, only meaningful for "sealed" */
  members: ReadonlyArray<{ userId: string; canEdit: boolean }>;
}

export interface FolderAccess {
  canView: boolean;
  /** upload, and add sub-folders */
  canUpload: boolean;
  /** rename, move to trash, change visibility, manage the member list */
  canManage: boolean;
}

const DENIED: FolderAccess = {
  canView: false,
  canUpload: false,
  canManage: false,
};

function isOwnerOrAdmin(subject: AccessSubject): boolean {
  return subject.role === "owner" || subject.role === "admin";
}

/** Can this person see through one folder in the chain? */
function passes(subject: AccessSubject, node: FolderNode): boolean {
  switch (node.visibility) {
    case "organisation":
      return true; // any internal user; externals are refused before this
    case "event":
      return subject.canViewEvent;
    case "division":
      return (
        isOwnerOrAdmin(subject) ||
        (node.divisionId !== null && subject.divisionIds.includes(node.divisionId))
      );
    case "sealed":
      // A global owner/admin gets NO automatic sight of a sealed folder.
      // "Restricted" that leadership can read anyway is not restricted, and
      // these folders hold the contracts and settlement figures.
      return node.members.some((m) => m.userId === subject.id);
  }
}

/**
 * Resolves access to the LAST folder in `chain`, which runs root-first and
 * ends with the folder itself.
 *
 * Every ancestor is checked, not just the folder itself. The narrow-only rule
 * makes the chain monotonic in theory, but a row that predates the rule — or
 * arrives by import — must not become a way in.
 */
export function resolveFolderAccess(
  subject: AccessSubject,
  chain: readonly FolderNode[],
): FolderAccess {
  // externals never reach the dataroom at any level; they receive documents
  // only through EPIC-018 links
  if (subject.role === "external") return DENIED;
  if (chain.length === 0) return DENIED;
  if (!chain.every((node) => passes(subject, node))) return DENIED;

  const self = chain[chain.length - 1];
  const sealedAnywhere = chain.some((n) => n.visibility === "sealed");

  // in a sealed chain, writing needs an explicit canEdit grant on the folder
  // itself; elsewhere anyone who can see it can contribute
  const canUpload = sealedAnywhere
    ? self.members.some((m) => m.userId === subject.id && m.canEdit)
    : true;

  const canManage =
    isOwnerOrAdmin(subject) || (self.createdBy !== null && self.createdBy === subject.id);

  return { canView: true, canUpload, canManage: canManage && canUpload };
}

/** A file is only as visible as the folder holding it. */
export function resolveFileAccess(
  subject: AccessSubject,
  chain: readonly FolderNode[],
): FolderAccess {
  return resolveFolderAccess(subject, chain);
}

/** Folders the person may see, for a listing. Keeps the filter in one place
 *  so no query can forget it. */
export function visibleFolders<T extends { id: string }>(
  subject: AccessSubject,
  folders: readonly T[],
  chainOf: (folder: T) => readonly FolderNode[],
): T[] {
  return folders.filter((f) => resolveFolderAccess(subject, chainOf(f)).canView);
}
