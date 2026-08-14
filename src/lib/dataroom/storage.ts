import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, statfs } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "@/lib/env";
import { filePath, resolveInRoot, versionPath } from "./paths";

// The ONLY module that knows where dataroom bytes live (EPIC-017 T-170).
//
// Nextcloud was rejected for this epic, but the decision was made reversible
// on purpose: nothing outside this file knows whether a version sits on a
// local disk, in Nextcloud or in S3. Swapping the backend means rewriting
// these functions and nothing else.
//
// Storage is a spinning 3.6 TB disk (/mnt/hdd2) while the NVMe `uploads`
// volume keeps the small hot files — avatars, posters, task attachments and
// the WhatsApp session credentials. Nothing here ever touches that volume.

export function storageRoot(): string {
  return process.env.DATAROOM_DIR || path.join(path.resolve(env.UPLOADS_DIR), "dataroom");
}

/** Thrown when a stream turns out bigger than the allowance granted before it
 *  started. The quota was checked on the declared size; this catches a lie. */
export class OverAllowanceError extends Error {
  constructor(readonly allowedBytes: number) {
    super("Upload exceeded the allowed size.");
  }
}

/** Free space on the storage disk, for the global floor rule. */
export async function freeDiskBytes(): Promise<number> {
  try {
    const fs = await statfs(storageRoot());
    return fs.bavail * fs.bsize;
  } catch {
    // an unreadable root must not silently look like infinite space
    return 0;
  }
}

/**
 * Writes one version and returns the bytes actually stored.
 *
 * `allowanceBytes` is the remaining quota decided before the write began. The
 * count is enforced *during* the stream because the browser's declared size
 * is a claim, not a fact: without this, one dishonest Content-Length fills
 * the disk. A rejected or failed write leaves nothing behind.
 */
export async function writeVersion(
  eventId: string,
  fileId: string,
  versionNo: number,
  source: ReadableStream<Uint8Array> | Buffer,
  allowanceBytes: number,
): Promise<number> {
  const relative = versionPath(eventId, fileId, versionNo);
  const absolute = resolveInRoot(storageRoot(), relative);
  await mkdir(path.dirname(absolute), { recursive: true });

  let written = 0;
  const counter = async function* (chunks: AsyncIterable<Buffer>) {
    for await (const chunk of chunks) {
      written += chunk.byteLength;
      if (written > allowanceBytes) throw new OverAllowanceError(allowanceBytes);
      yield chunk;
    }
  };

  const input = Buffer.isBuffer(source)
    ? Readable.from(source)
    : Readable.fromWeb(source as Parameters<typeof Readable.fromWeb>[0]);

  try {
    await pipeline(input, counter, createWriteStream(absolute));
  } catch (error) {
    // never leave a partial version on disk: it would count against the
    // quota while being unreadable
    await rm(absolute, { force: true }).catch(() => {});
    throw error;
  }
  return written;
}

export interface StoredVersion {
  sizeBytes: number;
  /** absolute path — for streaming only, never sent to a client */
  absolutePath: string;
}

/** Stat one version, or null when the bytes are gone. */
export async function statVersion(
  eventId: string,
  fileId: string,
  versionNo: number,
): Promise<StoredVersion | null> {
  const absolute = resolveInRoot(
    storageRoot(),
    versionPath(eventId, fileId, versionNo),
  );
  try {
    const info = await stat(absolute);
    return { sizeBytes: info.size, absolutePath: absolute };
  } catch {
    // the index says it exists but the bytes do not — the caller turns this
    // into an honest "file is missing", never a crash
    return null;
  }
}

export interface ReadRange {
  start: number;
  end: number;
}

/**
 * Opens a version for streaming, optionally a byte range so a PDF or video
 * can be scrubbed without sending the whole file. Streaming rather than
 * reading into memory is what keeps a 2 GB upload from taking the app down.
 */
export function openVersion(
  stored: StoredVersion,
  range?: ReadRange,
): ReadableStream<Uint8Array> {
  const node = createReadStream(
    stored.absolutePath,
    range ? { start: range.start, end: range.end } : undefined,
  );
  return Readable.toWeb(node) as ReadableStream<Uint8Array>;
}

/** Parses a Range header against a known size. Returns null for "send it
 *  all", and `unsatisfiable` for a range past the end (HTTP 416). */
export function parseRange(
  header: string | null,
  sizeBytes: number,
): ReadRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    // suffix form: the LAST n bytes
    const suffix = Number(rawEnd);
    if (suffix <= 0) return "unsatisfiable";
    start = Math.max(0, sizeBytes - suffix);
    end = sizeBytes - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : sizeBytes - 1;
  }
  if (start > end || start >= sizeBytes) return "unsatisfiable";
  return { start, end: Math.min(end, sizeBytes - 1) };
}

/** Removes every version of one file — used by the trash purge, never by a
 *  quota change. Lowering a limit must not destroy anything. */
export async function purgeFile(eventId: string, fileId: string): Promise<void> {
  const absolute = resolveInRoot(storageRoot(), filePath(eventId, fileId));
  await rm(absolute, { recursive: true, force: true });
}
