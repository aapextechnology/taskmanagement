import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dataroomAccessLog,
  dataroomFileVersions,
  dataroomFiles,
  dataroomShareLinks,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/permissions";
import { isId } from "./paths";
import { watermarkDecision } from "./watermark";
import {
  DEFAULT_EXPIRY_DAYS,
  gateRequirements,
  refusalMessage,
  resolveExpiry,
  verifyShareAttempt,
  type ShareVerdict,
} from "./share-rules";

// Share links for people outside the system (EPIC-018 T-180).
//
// The rules live in share-rules.ts; this file adds the database, the token
// and the audit entry. Two things are deliberate:
//   1. The token is stored only as a sha256 hash, so a database leak yields
//      nothing that opens. The plaintext is returned exactly once.
//   2. Every check runs on every request. Nothing is trusted from a cookie
//      set at the first visit, or a revocation would take effect only after
//      the visitor closed their browser.

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateShareInput {
  fileId: string;
  expiryDays?: number;
  passcode?: string;
  requireEmail?: boolean;
  allowedEmails?: string[] | null;
  allowDownload?: boolean;
  watermark?: boolean;
  label?: string;
}

export interface CreatedShare {
  id: string;
  /** the only time the plaintext token exists outside the recipient's URL */
  url: string;
  expiresAt: Date;
}

/**
 * Creates a link. The caller must already have proven it may see the file —
 * requireFileAccess in service.ts does that, and this is only reached from
 * there.
 */
export async function createShareLink(
  actor: Actor,
  file: {
    id: string;
    eventId: string;
    name: string;
    mimeType?: string;
    sizeBytes?: number;
  },
  input: Omit<CreateShareInput, "fileId">,
): Promise<CreatedShare> {
  if (input.watermark) {
    // decided now, not at view time: a switch that silently does nothing is
    // worse than no switch, and the sender can still export to PDF instead
    const verdict = watermarkDecision(
      file.mimeType ?? "application/octet-stream",
      file.sizeBytes ?? 0,
    );
    if (!verdict.ok) throw new Error(verdict.reason);
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = resolveExpiry(input.expiryDays ?? DEFAULT_EXPIRY_DAYS, new Date());

  const [row] = await db
    .insert(dataroomShareLinks)
    .values({
      fileId: file.id,
      eventId: file.eventId,
      tokenHash: hashToken(token),
      label: input.label?.trim() || null,
      expiresAt,
      passcodeHash: input.passcode?.trim()
        ? hashPassword(input.passcode.trim())
        : null,
      requireEmail: input.requireEmail ?? true,
      allowedEmails: (input.allowedEmails ?? null) as never,
      allowDownload: input.allowDownload ?? true,
      watermark: input.watermark ?? false,
      createdBy: actor.id,
    })
    .returning({ id: dataroomShareLinks.id });

  await logActivity({
    actorId: actor.id,
    action: "dataroom.share_created",
    entity: `dataroom_file:${file.id}`,
    // the token never reaches the activity log
    detail: { fileName: file.name, expiresAt: expiresAt.toISOString() },
    eventId: file.eventId,
  });

  return { id: row.id, url: `${env.APP_URL}/share/${token}`, expiresAt };
}

export async function revokeShareLink(actor: Actor, linkId: string) {
  if (!isId(linkId)) throw new Error("Unknown link.");
  const [link] = await db
    .select()
    .from(dataroomShareLinks)
    .where(eq(dataroomShareLinks.id, linkId))
    .limit(1);
  if (!link) throw new Error("Unknown link.");

  await db
    .update(dataroomShareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(dataroomShareLinks.id, linkId));
  await logActivity({
    actorId: actor.id,
    action: "dataroom.share_revoked",
    entity: `dataroom_file:${link.fileId}`,
    detail: {},
    eventId: link.eventId,
  });
}

export interface ShareLinkView {
  id: string;
  label: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  hasPasscode: boolean;
  allowDownload: boolean;
  watermark: boolean;
  requireEmail: boolean;
  allowedEmails: string[] | null;
  opens: number;
  createdAt: Date;
  /** decided here, not in the browser: the server owns the clock, and a
   *  render-time Date.now() is impure under the React compiler */
  expired: boolean;
}

export async function listShareLinks(fileId: string): Promise<ShareLinkView[]> {
  const rows = await db
    .select()
    .from(dataroomShareLinks)
    .where(eq(dataroomShareLinks.fileId, fileId))
    .orderBy(desc(dataroomShareLinks.createdAt));

  const counts = await db
    .select({
      shareLinkId: dataroomAccessLog.shareLinkId,
      total: sql<number>`count(*)::int`,
    })
    .from(dataroomAccessLog)
    .where(eq(dataroomAccessLog.fileId, fileId))
    .groupBy(dataroomAccessLog.shareLinkId);
  const byLink = new Map(counts.map((c) => [c.shareLinkId, c.total]));

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    expired: r.expiresAt.getTime() <= now,
    label: r.label,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    hasPasscode: r.passcodeHash !== null,
    allowDownload: r.allowDownload,
    watermark: r.watermark,
    requireEmail: r.requireEmail,
    allowedEmails: (r.allowedEmails as string[] | null) ?? null,
    opens: byLink.get(r.id) ?? 0,
    createdAt: r.createdAt,
  }));
}

export interface ResolvedShare {
  linkId: string;
  fileId: string;
  eventId: string;
  fileName: string;
  versionNo: number;
  mimeType: string;
  allowDownload: boolean;
  watermark: boolean;
  viewerEmail: string | null;
  /** so the gate can mint a pass that survives the next request */
  passcodeOk: boolean;
}

export type ShareResolution =
  | { ok: true; share: ResolvedShare }
  | { ok: false; message: string; needsPasscode: boolean; needsEmail: boolean };

/**
 * Resolves a visitor's attempt. Re-reads the link every time — expiry,
 * revocation, passcode and the allowlist are never cached, so revoking takes
 * effect on the visitor's very next request.
 */
export async function resolveShare(
  token: string,
  attempt: {
    passcode?: string;
    email?: string;
    /** carried by the signed pass cookie: the passcode was already proven */
    passcodeVerified?: boolean;
  },
): Promise<ShareResolution> {
  const [link] = token
    ? await db
        .select()
        .from(dataroomShareLinks)
        .where(eq(dataroomShareLinks.tokenHash, hashToken(token)))
        .limit(1)
    : [];

  const passcodeOk =
    !link?.passcodeHash ||
    attempt.passcodeVerified === true ||
    (attempt.passcode
      ? verifyPassword(attempt.passcode, link.passcodeHash)
      : false);

  const state = link
    ? {
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        passcodeHash: link.passcodeHash,
        requireEmail: link.requireEmail,
        allowedEmails: (link.allowedEmails as string[] | null) ?? null,
      }
    : null;

  const verdict: ShareVerdict = verifyShareAttempt(
    state,
    {
      passcodeOk,
      passcodeAttempted: Boolean(attempt.passcode),
      email: attempt.email ?? null,
    },
    new Date(),
  );

  if (!verdict.ok) {
    // Once the link is known live, report EVERYTHING it asks for, so the form
    // can show both boxes at once. A dead link (reason "unknown") reports
    // nothing, so it still gives away neither its existence nor its shape.
    const needs =
      verdict.reason === "unknown" || !state
        ? { passcode: false, email: false }
        : gateRequirements(state);
    return {
      ok: false,
      message: refusalMessage(verdict.reason),
      needsPasscode: needs.passcode,
      needsEmail: needs.email,
    };
  }

  const [file] = await db
    .select()
    .from(dataroomFiles)
    .where(eq(dataroomFiles.id, link!.fileId))
    .limit(1);
  // a trashed file behaves as if the link were dead: the sender pulled it
  if (!file || file.trashedAt !== null) {
    return { ok: false, message: refusalMessage("unknown"), needsPasscode: false, needsEmail: false };
  }

  const [version] = await db
    .select()
    .from(dataroomFileVersions)
    .where(
      and(
        eq(dataroomFileVersions.fileId, file.id),
        eq(dataroomFileVersions.versionNo, file.currentVersion),
      ),
    )
    .limit(1);
  if (!version) {
    return { ok: false, message: refusalMessage("unknown"), needsPasscode: false, needsEmail: false };
  }

  return {
    ok: true,
    share: {
      linkId: link!.id,
      fileId: file.id,
      eventId: file.eventId,
      fileName: file.name,
      versionNo: version.versionNo,
      mimeType: version.mimeType,
      allowDownload: link!.allowDownload,
      watermark: link!.watermark,
      viewerEmail: verdict.viewerEmail,
      passcodeOk,
    },
  };
}

/** Records an outside open in the same log as internal reads, so one activity
 *  view answers "who has seen this contract" for everyone. */
export async function logShareAccess(
  share: ResolvedShare,
  action: "view" | "download",
) {
  await db.insert(dataroomAccessLog).values({
    actorId: null,
    viewerEmail: share.viewerEmail,
    shareLinkId: share.linkId,
    fileId: share.fileId,
    folderId: null,
    eventId: share.eventId,
    fileName: share.fileName,
    versionNo: share.versionNo,
    action,
  });
}
