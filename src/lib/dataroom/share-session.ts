import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Proof that this browser passed a share link's gate (EPIC-018 T-181).
//
// What it is: a signed note saying "this visitor answered the passcode and
// identified themselves as <email>, for THIS token, at <time>".
//
// What it is NOT: authorisation. Every request still re-reads the link from
// the database and re-applies expiry, revocation and the allowlist — so
// revoking a link stops the very next request, cookie or no cookie. The only
// thing the cookie saves is re-typing the passcode, which is why it carries
// no secret and dies after two hours.

const TTL_MS = 2 * 60 * 60 * 1000;

export const SHARE_COOKIE = "dr_share";

function sign(payload: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
}

/**
 * `passcodeOk` records that the visitor already typed the passcode correctly.
 * It has to travel in the pass, because the passcode itself is never stored
 * anywhere on the visitor's side — without this flag, a passcode-protected
 * link would pass its gate and then fail on every request for the bytes.
 * Forging it is not possible: the flag is inside the signed payload.
 */
export function issueSharePass(
  token: string,
  email: string | null,
  passcodeOk: boolean,
): string {
  const issuedAt = Date.now();
  const flag = passcodeOk ? "1" : "0";
  const payload = `${token}|${email ?? ""}|${flag}|${issuedAt}`;
  return `${email ?? ""}|${flag}|${issuedAt}|${sign(payload)}`;
}

export interface SharePass {
  email: string | null;
  passcodeOk: boolean;
}

/** Returns the pass only when the signature, the token binding and the age
 *  all check out. A pass for one link never opens another. */
export function readSharePass(token: string, cookie: string | undefined): SharePass | null {
  if (!cookie) return null;
  const parts = cookie.split("|");
  if (parts.length !== 4) return null;
  const [email, flag, issuedRaw, signature] = parts;

  const issuedAt = Number(issuedRaw);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > TTL_MS) return null;

  const expected = sign(`${token}|${email}|${flag}|${issuedAt}`);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { email: email || null, passcodeOk: flag === "1" };
}
