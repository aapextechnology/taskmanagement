import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dataroomAccessLog,
  dataroomFileVersions,
  dataroomFiles,
  dataroomFolderMembers,
  dataroomFolders,
  events,
  profiles,
} from "@/db/schema";
import { assertCan, PermissionError, type Actor } from "@/lib/permissions";
import {
  canNest,
  DEFAULT_VISIBILITY,
  resolveFolderAccess,
  wouldOrphan,
  wouldOrphanByDowngrade,
  type AccessSubject,
  type FolderNode,
  type Visibility,
} from "./access";
import { isId } from "./paths";
import {
  DEFAULT_QUOTA_BYTES,
  crossesWarningLine,
  decideUpload,
  usage,
} from "./quota";
import {
  OverAllowanceError,
  freeDiskBytes,
  purgeFile,
  writeVersion,
} from "./storage";

// Dataroom service (EPIC-017 T-172). Permission checks live here; the pure
// rules live in access.ts and quota.ts, and the bytes in storage.ts.
//
// Every read of a file is written to dataroom_access_log. There is no second
// route to the bytes, so the log cannot be bypassed — that is the whole
// reason storage sits behind the app instead of in a browsable share.

function subjectFor(actor: Actor, canViewEvent: boolean): AccessSubject {
  return {
    id: actor.id,
    role: actor.role,
    divisionIds: actor.memberships.map((m) => m.divisionId),
    canViewEvent,
  };
}

/** Every folder of an event with its sealed member list, once. */
async function loadFolders(eventId: string) {
  const rows = await db
    .select()
    .from(dataroomFolders)
    .where(eq(dataroomFolders.eventId, eventId))
    .orderBy(asc(dataroomFolders.name));
  if (rows.length === 0) return { rows, members: new Map<string, FolderNode["members"]>() };

  const grants = await db
    .select()
    .from(dataroomFolderMembers)
    .where(
      inArray(
        dataroomFolderMembers.folderId,
        rows.map((r) => r.id),
      ),
    );
  const members = new Map<string, Array<{ userId: string; canEdit: boolean }>>();
  for (const g of grants) {
    const list = members.get(g.folderId) ?? [];
    list.push({ userId: g.userId, canEdit: g.canEdit });
    members.set(g.folderId, list);
  }
  return { rows, members };
}

type FolderRow = Awaited<ReturnType<typeof loadFolders>>["rows"][number];

/** Root-first chain for one folder, so access can check every ancestor. */
function chainFor(
  folderId: string,
  byId: Map<string, FolderRow>,
  members: Map<string, FolderNode["members"]>,
): FolderNode[] {
  const chain: FolderNode[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift({
      id: current.id,
      visibility: current.visibility,
      divisionId: current.divisionId,
      createdBy: current.createdBy,
      members: members.get(current.id) ?? [],
    });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

export interface FolderView {
  id: string;
  name: string;
  parentId: string | null;
  visibility: Visibility;
  divisionId: string | null;
  canUpload: boolean;
  canManage: boolean;
}

/** Folders the actor may see. The filter lives here so no caller can forget
 *  it, mirroring listPages in the Pages module. */
export async function listFolders(
  actor: Actor,
  eventId: string,
): Promise<FolderView[]> {
  assertCan(actor, "event.view");
  if (!isId(eventId)) return [];
  const { rows, members } = await loadFolders(eventId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const subject = subjectFor(actor, true);

  const out: FolderView[] = [];
  for (const row of rows) {
    const access = resolveFolderAccess(subject, chainFor(row.id, byId, members));
    if (!access.canView) continue;
    out.push({
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      visibility: row.visibility,
      divisionId: row.divisionId,
      canUpload: access.canUpload,
      canManage: access.canManage,
    });
  }
  return out;
}

/** Loads one folder and throws unless the actor may do `need` with it. */
async function requireFolder(
  actor: Actor,
  folderId: string,
  need: "view" | "upload" | "manage",
) {
  assertCan(actor, "event.view");
  if (!isId(folderId)) throw new PermissionError("event.view");
  const [folder] = await db
    .select()
    .from(dataroomFolders)
    .where(eq(dataroomFolders.id, folderId))
    .limit(1);
  if (!folder) throw new PermissionError("event.view");

  const { rows, members } = await loadFolders(folder.eventId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const access = resolveFolderAccess(
    subjectFor(actor, true),
    chainFor(folder.id, byId, members),
  );
  const ok =
    need === "view" ? access.canView : need === "upload" ? access.canUpload : access.canManage;
  if (!ok) throw new PermissionError("event.view");
  return { folder, access };
}

export async function createFolder(
  actor: Actor,
  input: {
    eventId: string;
    parentId?: string | null;
    name: string;
    visibility?: Visibility;
    divisionId?: string | null;
  },
): Promise<{ id: string }> {
  assertCan(actor, "event.view");
  const name = input.name.trim();
  if (!name) throw new Error("A folder needs a name.");
  const visibility = input.visibility ?? DEFAULT_VISIBILITY;
  if (visibility === "division" && !input.divisionId) {
    // a division folder without a division would admit nobody, which reads
    // as a bug rather than a decision
    throw new Error("Choose which division this folder belongs to.");
  }

  if (input.parentId) {
    const { folder: parent } = await requireFolder(actor, input.parentId, "upload");
    if (!canNest(parent.visibility, visibility)) {
      throw new Error(
        `A folder inside "${parent.name}" cannot be more open than it is (${parent.visibility}).`,
      );
    }
    if (parent.eventId !== input.eventId) {
      throw new Error("That parent belongs to another event.");
    }
  }

  const [row] = await db
    .insert(dataroomFolders)
    .values({
      eventId: input.eventId,
      parentId: input.parentId ?? null,
      name,
      visibility,
      divisionId: visibility === "division" ? (input.divisionId ?? null) : null,
      createdBy: actor.id,
    })
    .returning({ id: dataroomFolders.id });

  if (visibility === "sealed") {
    // A sealed folder admits only the people on its list, and the creator is
    // not implicitly on it — without this the folder is orphaned the moment
    // it exists: nobody can open it, not even to add the first member.
    // Granting explicitly (rather than special-casing the creator in the
    // access rules) keeps the grant visible in the member list and auditable.
    await db.insert(dataroomFolderMembers).values({
      folderId: row.id,
      userId: actor.id,
      canEdit: true,
    });
  }
  return row;
}

// ---- sealed folder membership --------------------------------------------

export interface FolderMemberView {
  userId: string;
  name: string;
  email: string;
  canEdit: boolean;
}

export async function listFolderMembers(
  actor: Actor,
  folderId: string,
): Promise<FolderMemberView[]> {
  await requireFolder(actor, folderId, "manage");
  const rows = await db
    .select({
      userId: dataroomFolderMembers.userId,
      canEdit: dataroomFolderMembers.canEdit,
      name: profiles.name,
      email: profiles.email,
    })
    .from(dataroomFolderMembers)
    .innerJoin(profiles, eq(dataroomFolderMembers.userId, profiles.id))
    .where(eq(dataroomFolderMembers.folderId, folderId))
    .orderBy(asc(profiles.name));
  return rows;
}

async function membersOf(folderId: string) {
  return db
    .select({
      userId: dataroomFolderMembers.userId,
      canEdit: dataroomFolderMembers.canEdit,
    })
    .from(dataroomFolderMembers)
    .where(eq(dataroomFolderMembers.folderId, folderId));
}

export async function addFolderMember(
  actor: Actor,
  folderId: string,
  userId: string,
  canEdit: boolean,
) {
  const { folder } = await requireFolder(actor, folderId, "manage");
  if (folder.visibility !== "sealed") {
    // any other level draws its audience from divisions or the event, so a
    // member list there would be decoration that quietly implies control
    throw new Error("Only a sealed folder has a member list.");
  }
  if (!isId(userId)) throw new Error("Unknown person.");

  const [person] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!person) throw new Error("Unknown person.");
  if (person.role === "external") {
    // externals never reach the dataroom; letting one onto a list would
    // create a grant that silently never works
    throw new Error("External accounts cannot be given dataroom access.");
  }

  // downgrading the last editor strands the folder exactly like removing them
  if (!canEdit) {
    const current = await membersOf(folderId);
    if (current.some((m) => m.userId === userId && m.canEdit) &&
        wouldOrphanByDowngrade(current, userId)) {
      throw new Error(
        "Someone must keep edit rights, or nobody could ever open this folder again.",
      );
    }
  }

  await db
    .insert(dataroomFolderMembers)
    .values({ folderId, userId, canEdit })
    .onConflictDoUpdate({
      target: [dataroomFolderMembers.folderId, dataroomFolderMembers.userId],
      set: { canEdit },
    });
}

export async function removeFolderMember(
  actor: Actor,
  folderId: string,
  userId: string,
) {
  await requireFolder(actor, folderId, "manage");
  const current = await membersOf(folderId);
  if (wouldOrphan(current, userId)) {
    throw new Error(
      "This is the last person who can manage the folder. Add someone else first, or nobody could open it again.",
    );
  }
  await db
    .delete(dataroomFolderMembers)
    .where(
      and(
        eq(dataroomFolderMembers.folderId, folderId),
        eq(dataroomFolderMembers.userId, userId),
      ),
    );
}

// ---- quota ----------------------------------------------------------------

/** Bytes an event holds: every version of every file, including the trash,
 *  because both still occupy the disk (EPIC-017 quota rules 1 and 2). */
export async function usedBytes(eventId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${dataroomFileVersions.sizeBytes}), 0)::bigint`,
    })
    .from(dataroomFileVersions)
    .innerJoin(dataroomFiles, eq(dataroomFileVersions.fileId, dataroomFiles.id))
    .where(eq(dataroomFiles.eventId, eventId));
  return Number(row?.total ?? 0);
}

export async function quotaFor(eventId: string): Promise<number> {
  const [row] = await db
    .select({ quota: events.dataroomQuotaBytes })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return row?.quota ?? DEFAULT_QUOTA_BYTES;
}

export async function eventUsage(eventId: string) {
  const [used, limit] = await Promise.all([usedBytes(eventId), quotaFor(eventId)]);
  return usage(used, limit);
}

// ---- upload ---------------------------------------------------------------

export interface UploadResult {
  fileId: string;
  versionNo: number;
  sizeBytes: number;
  /** true when this upload took the event past 80% — fires the WA warning */
  crossedWarning: boolean;
}

/**
 * Stores a new file, or a new version of one. The quota is decided before a
 * byte is written and enforced again mid-stream, because the declared size is
 * a claim; a stream that outgrows its allowance is aborted and removed.
 */
export async function uploadFile(
  actor: Actor,
  input: {
    folderId: string;
    name: string;
    declaredSize: number;
    mimeType?: string;
    body: ReadableStream<Uint8Array> | Buffer;
    /** set to add a version to an existing file instead of creating one */
    replaceFileId?: string;
  },
): Promise<UploadResult> {
  const { folder } = await requireFolder(actor, input.folderId, "upload");
  const eventId = folder.eventId;

  const [used, limit, free] = await Promise.all([
    usedBytes(eventId),
    quotaFor(eventId),
    freeDiskBytes(),
  ]);
  const verdict = decideUpload({
    usedBytes: used,
    limitBytes: limit,
    incomingBytes: input.declaredSize,
    freeDiskBytes: free,
  });
  if (!verdict.ok) throw new Error(verdict.message);

  let fileId = input.replaceFileId ?? null;
  let versionNo = 1;
  if (fileId) {
    const [existing] = await db
      .select()
      .from(dataroomFiles)
      .where(eq(dataroomFiles.id, fileId))
      .limit(1);
    if (!existing || existing.folderId !== input.folderId) {
      throw new Error("That file is not in this folder.");
    }
    versionNo = existing.currentVersion + 1;
  } else {
    const [created] = await db
      .insert(dataroomFiles)
      .values({
        eventId,
        folderId: input.folderId,
        name: input.name.trim() || "Untitled",
        currentVersion: 1,
        createdBy: actor.id,
      })
      .returning({ id: dataroomFiles.id });
    fileId = created.id;
  }

  let written: number;
  try {
    written = await writeVersion(
      eventId,
      fileId,
      versionNo,
      input.body,
      verdict.remainingAfter + input.declaredSize,
    );
  } catch (error) {
    // a first version that never landed leaves a file row pointing at
    // nothing — remove it rather than showing an empty entry
    if (!input.replaceFileId) {
      await db.delete(dataroomFiles).where(eq(dataroomFiles.id, fileId));
    }
    if (error instanceof OverAllowanceError) {
      throw new Error("That file is larger than it claimed and was rejected.");
    }
    throw error;
  }

  await db.insert(dataroomFileVersions).values({
    fileId,
    versionNo,
    sizeBytes: written,
    mimeType: input.mimeType || "application/octet-stream",
    uploadedBy: actor.id,
  });
  if (input.replaceFileId) {
    await db
      .update(dataroomFiles)
      .set({ currentVersion: versionNo, updatedAt: new Date() })
      .where(eq(dataroomFiles.id, fileId));
  }

  await logAccess(actor, {
    fileId,
    eventId,
    fileName: input.name,
    versionNo,
    action: "upload",
  });

  return {
    fileId,
    versionNo,
    sizeBytes: written,
    crossedWarning: crossesWarningLine(used, used + written, limit),
  };
}

// ---- access log -----------------------------------------------------------

async function logAccess(
  actor: Actor,
  entry: {
    fileId: string;
    eventId: string;
    fileName: string;
    versionNo: number | null;
    action: "view" | "download" | "upload" | "trash" | "restore";
  },
) {
  await db.insert(dataroomAccessLog).values({
    actorId: actor.id,
    fileId: entry.fileId,
    eventId: entry.eventId,
    fileName: entry.fileName,
    versionNo: entry.versionNo,
    action: entry.action,
  });
}

export async function listAccessLog(actor: Actor, eventId: string, limit = 100) {
  assertCan(actor, "event.view");
  return db
    .select()
    .from(dataroomAccessLog)
    .where(eq(dataroomAccessLog.eventId, eventId))
    .orderBy(desc(dataroomAccessLog.createdAt))
    .limit(limit);
}

// ---- files ----------------------------------------------------------------

export async function listFiles(actor: Actor, folderId: string) {
  await requireFolder(actor, folderId, "view");
  return db
    .select()
    .from(dataroomFiles)
    .where(and(eq(dataroomFiles.folderId, folderId), isNull(dataroomFiles.trashedAt)))
    .orderBy(asc(dataroomFiles.name));
}

export async function listVersions(actor: Actor, fileId: string) {
  const file = await requireFile(actor, fileId, "view");
  return db
    .select()
    .from(dataroomFileVersions)
    .where(eq(dataroomFileVersions.fileId, file.id))
    .orderBy(desc(dataroomFileVersions.versionNo));
}

async function requireFile(
  actor: Actor,
  fileId: string,
  need: "view" | "upload" | "manage",
) {
  if (!isId(fileId)) throw new PermissionError("event.view");
  const [file] = await db
    .select()
    .from(dataroomFiles)
    .where(eq(dataroomFiles.id, fileId))
    .limit(1);
  if (!file) throw new PermissionError("event.view");
  await requireFolder(actor, file.folderId, need);
  return file;
}

/** Resolves a file for streaming AND writes the audit entry. The two are one
 *  operation on purpose: a download that skipped the log would be invisible. */
export async function openForDownload(
  actor: Actor,
  fileId: string,
  versionNo?: number,
) {
  const file = await requireFile(actor, fileId, "view");
  const wanted = versionNo ?? file.currentVersion;
  const [version] = await db
    .select()
    .from(dataroomFileVersions)
    .where(
      and(
        eq(dataroomFileVersions.fileId, file.id),
        eq(dataroomFileVersions.versionNo, wanted),
      ),
    )
    .limit(1);
  if (!version) return null;

  await logAccess(actor, {
    fileId: file.id,
    eventId: file.eventId,
    fileName: file.name,
    versionNo: wanted,
    action: "download",
  });
  return { file, version };
}

export async function trashFile(actor: Actor, fileId: string) {
  const file = await requireFile(actor, fileId, "upload");
  await db
    .update(dataroomFiles)
    .set({ trashedAt: new Date(), trashedBy: actor.id })
    .where(eq(dataroomFiles.id, fileId));
  await logAccess(actor, {
    fileId,
    eventId: file.eventId,
    fileName: file.name,
    versionNo: null,
    action: "trash",
  });
}

export async function restoreFile(actor: Actor, fileId: string) {
  const file = await requireFile(actor, fileId, "upload");
  await db
    .update(dataroomFiles)
    .set({ trashedAt: null, trashedBy: null })
    .where(eq(dataroomFiles.id, fileId));
  await logAccess(actor, {
    fileId,
    eventId: file.eventId,
    fileName: file.name,
    versionNo: null,
    action: "restore",
  });
}

/**
 * Removes trashed files past the retention window, freeing their quota. Run
 * from cron — a quota that never recovers is the price of skipping this.
 */
export async function purgeTrash(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const doomed = await db
    .select({ id: dataroomFiles.id, eventId: dataroomFiles.eventId })
    .from(dataroomFiles)
    .where(
      and(
        isNotNull(dataroomFiles.trashedAt),
        sql`${dataroomFiles.trashedAt} < ${cutoff}`,
      ),
    );
  for (const file of doomed) {
    await purgeFile(file.eventId, file.id);
    // the access log keeps its rows: who read this contract must outlive it
    await db.delete(dataroomFiles).where(eq(dataroomFiles.id, file.id));
  }
  return doomed.length;
}
