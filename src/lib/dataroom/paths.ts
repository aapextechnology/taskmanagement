import path from "node:path";

// Where a dataroom object lives on disk (EPIC-017 T-170).
//
// Pure and separate from storage.ts because this is the module that turns
// caller-supplied ids into filesystem paths — the classic place for a
// traversal bug. Ids are validated as UUIDs before any join, so a crafted
// "../../etc" can never reach path.join at all.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isId(value: string): boolean {
  return typeof value === "string" && UUID.test(value);
}

export class UnsafePathError extends Error {}

/**
 * Path of one version, relative to the storage root:
 * `<eventId>/<fileId>/<versionNo>`.
 *
 * A version is always a new object — nothing is ever overwritten — so an
 * earlier copy of a signed contract survives a careless re-upload.
 */
export function versionPath(
  eventId: string,
  fileId: string,
  versionNo: number,
): string {
  if (!isId(eventId)) throw new UnsafePathError("Invalid event id.");
  if (!isId(fileId)) throw new UnsafePathError("Invalid file id.");
  if (!Number.isInteger(versionNo) || versionNo < 1) {
    throw new UnsafePathError("Invalid version number.");
  }
  return path.posix.join(eventId, fileId, String(versionNo));
}

/** Directory holding every version of one file — the unit a purge removes. */
export function filePath(eventId: string, fileId: string): string {
  if (!isId(eventId)) throw new UnsafePathError("Invalid event id.");
  if (!isId(fileId)) throw new UnsafePathError("Invalid file id.");
  return path.posix.join(eventId, fileId);
}

/**
 * Resolves a relative path inside the root and refuses anything that escapes
 * it. Belt and braces: `versionPath` already rejects non-UUID input, but this
 * guards any future caller that builds a path some other way.
 */
export function resolveInRoot(root: string, relative: string): string {
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new UnsafePathError("Path escapes the storage root.");
  }
  return target;
}

/**
 * A download filename safe for the Content-Disposition header: no quotes, no
 * newlines (header injection), no path separators.
 */
export function safeDownloadName(name: string): string {
  const cleaned = name
    .replace(/["]/g, "")
    .replace(/[/\\]/g, "-")
    // CR/LF would let a crafted filename inject a header; collapsing runs of
    // whitespace also keeps "a\r\nb" from becoming "a  b"
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 200) || "download";
}
