// Pure rules for a share link (EPIC-018 T-180). No database, no crypto —
// just the decisions, so every refusal path is unit-tested.
//
// The guiding rule: a refusal must never reveal anything about the file. An
// expired link, a revoked link and a link that never existed all look the
// same from outside.

export const MIN_EXPIRY_DAYS = 1;
export const MAX_EXPIRY_DAYS = 365;
export const DEFAULT_EXPIRY_DAYS = 14;

export type ShareRefusal =
  | "unknown" // no such link — also used for expired and revoked
  | "passcode"
  | "email_required"
  | "email_not_allowed";

export interface ShareLinkState {
  expiresAt: Date;
  revokedAt: Date | null;
  passcodeHash: string | null;
  requireEmail: boolean;
  /** null = anyone who identifies themselves */
  allowedEmails: string[] | null;
}

export interface ShareAttempt {
  /** already verified against passcodeHash by the caller */
  passcodeOk: boolean;
  email: string | null;
}

export type ShareVerdict =
  | { ok: true; viewerEmail: string | null }
  | { ok: false; reason: ShareRefusal };

/** Addresses are compared case-insensitively and trimmed; an allowlist that
 *  misses because of a capital letter would look like a bug to the sender. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isPlausibleEmail(raw: string): boolean {
  const value = normaliseEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

/**
 * Decides one attempt to open a link. Order matters: existence first, so a
 * revoked link cannot be distinguished from a wrong passcode on a live one.
 */
export function verifyShareAttempt(
  link: ShareLinkState | null,
  attempt: ShareAttempt,
  now: Date,
): ShareVerdict {
  // "unknown" covers missing, expired and revoked on purpose — telling an
  // outsider "this link expired" already confirms the file exists
  if (!link) return { ok: false, reason: "unknown" };
  if (link.revokedAt !== null) return { ok: false, reason: "unknown" };
  if (link.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "unknown" };
  }

  if (link.passcodeHash !== null && !attempt.passcodeOk) {
    return { ok: false, reason: "passcode" };
  }

  if (!link.requireEmail && link.allowedEmails === null) {
    return { ok: true, viewerEmail: null };
  }

  const email = attempt.email ? normaliseEmail(attempt.email) : "";
  if (!email || !isPlausibleEmail(email)) {
    return { ok: false, reason: "email_required" };
  }
  if (link.allowedEmails !== null) {
    const allowed = link.allowedEmails.map(normaliseEmail);
    if (!allowed.includes(email)) {
      return { ok: false, reason: "email_not_allowed" };
    }
  }
  return { ok: true, viewerEmail: email };
}

/** Wording shown to the visitor. Deliberately says nothing about the file. */
export function refusalMessage(reason: ShareRefusal): string {
  switch (reason) {
    case "unknown":
      return "This link is no longer valid. Ask whoever sent it for a new one.";
    case "passcode":
      return "That passcode is not right.";
    case "email_required":
      return "Enter your email address to open this document.";
    case "email_not_allowed":
      return "This link was not shared with that address.";
  }
}

/**
 * An expiry is required and bounded. A link with no end date is precisely the
 * public-link failure mode this epic exists to avoid.
 */
export function resolveExpiry(days: number, now: Date): Date {
  if (!Number.isFinite(days)) {
    throw new Error("Choose how long the link should work.");
  }
  const clamped = Math.min(Math.max(Math.round(days), MIN_EXPIRY_DAYS), MAX_EXPIRY_DAYS);
  return new Date(now.getTime() + clamped * 86_400_000);
}

/** Parses the emails an admin typed into the allowlist box. */
export function parseAllowedEmails(raw: string): string[] | null {
  const list = raw
    .split(/[\s,;]+/)
    .map(normaliseEmail)
    .filter(Boolean);
  if (list.length === 0) return null;
  const bad = list.filter((e) => !isPlausibleEmail(e));
  if (bad.length > 0) {
    throw new Error(`Not an email address: ${bad.join(", ")}`);
  }
  return [...new Set(list)];
}
