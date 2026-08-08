import { can, type Actor } from "@/lib/permissions";

// Pure helpers for the document library (EPIC-008 T-082). No DB, no I/O —
// service.ts wraps these around the actual `documents` table rows.

export const DOCUMENT_CATEGORIES = [
  "contract",
  "permit",
  "rider",
  "stage_plot",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface DocumentRecord {
  id: string;
  eventId: string;
  divisionId: string;
  category: DocumentCategory;
  title: string;
  filePath: string;
}

export interface DocumentFilters {
  category?: DocumentCategory;
  divisionId?: string;
}

export function filterDocuments<T extends DocumentRecord>(
  docs: T[],
  filters: DocumentFilters,
): T[] {
  return docs.filter((doc) => {
    if (filters.category && doc.category !== filters.category) return false;
    if (filters.divisionId && doc.divisionId !== filters.divisionId) return false;
    return true;
  });
}

// Scope a document list down to what the actor may see, via the central
// `document.view` capability — one check per division represented.
export function visibleDocuments<T extends DocumentRecord>(
  actor: Actor,
  docs: T[],
): T[] {
  return docs.filter((doc) =>
    can(actor, "document.view", { divisionId: doc.divisionId }),
  );
}

// Build the download href, rejecting anything that isn't a plain relative
// path under UPLOADS_DIR (mirrors the /api/files traversal guard).
export function documentDownloadHref(doc: DocumentRecord): string {
  const { filePath } = doc;
  if (filePath.startsWith("/")) {
    throw new Error("Invalid document path: absolute paths are not allowed.");
  }
  const segments = filePath.split("/");
  if (segments.includes("..")) {
    throw new Error("Invalid document path: traversal segments are not allowed.");
  }
  return `/api/files/${filePath}`;
}
