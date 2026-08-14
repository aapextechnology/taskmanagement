import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPIRY_DAYS,
  gateRequirements,
  MAX_EXPIRY_DAYS,
  isPlausibleEmail,
  normaliseEmail,
  parseAllowedEmails,
  refusalMessage,
  resolveExpiry,
  verifyShareAttempt,
  type ShareLinkState,
} from "./share-rules";

const NOW = new Date("2026-08-11T10:00:00Z");
const LATER = new Date("2026-08-25T10:00:00Z");

function link(over: Partial<ShareLinkState> = {}): ShareLinkState {
  return {
    expiresAt: LATER,
    revokedAt: null,
    passcodeHash: null,
    requireEmail: true,
    allowedEmails: null,
    ...over,
  };
}

const gave = (email: string | null) => ({ passcodeOk: true, email });

describe("verifyShareAttempt — refusals reveal nothing", () => {
  it("treats missing, expired and revoked links identically", () => {
    // any difference between them tells an outsider the file exists
    const missing = verifyShareAttempt(null, gave("a@b.test"), NOW);
    const expired = verifyShareAttempt(
      link({ expiresAt: new Date("2026-08-01T00:00:00Z") }),
      gave("a@b.test"),
      NOW,
    );
    const revoked = verifyShareAttempt(link({ revokedAt: NOW }), gave("a@b.test"), NOW);
    expect(missing).toEqual({ ok: false, reason: "unknown" });
    expect(expired).toEqual(missing);
    expect(revoked).toEqual(missing);
  });

  it("expires exactly at the boundary, not a moment after", () => {
    expect(verifyShareAttempt(link({ expiresAt: NOW }), gave("a@b.test"), NOW).ok).toBe(
      false,
    );
  });

  it("checks existence before the passcode", () => {
    // otherwise a wrong passcode on a live link differs from one on a dead
    // link, and that difference is itself a disclosure
    const dead = link({ revokedAt: NOW, passcodeHash: "scrypt$x$y" });
    expect(
      verifyShareAttempt(
        dead,
        { passcodeOk: false, passcodeAttempted: true, email: "a@b.test" },
        NOW,
      ),
    ).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("gateRequirements — every requirement at once", () => {
  it("reports both boxes for a link that wants both", () => {
    // the bug this replaced: requirements were revealed one refusal at a
    // time, so filling the passcode dropped the email box and vice versa,
    // and the visitor could never satisfy both
    expect(
      gateRequirements(link({ passcodeHash: "scrypt$x$y", requireEmail: true })),
    ).toEqual({ passcode: true, email: true });
  });

  it("asks for an email when an allowlist exists even without requireEmail", () => {
    expect(
      gateRequirements(link({ requireEmail: false, allowedEmails: ["a@b.test"] })),
    ).toEqual({ passcode: false, email: true });
  });

  it("asks for nothing when the link is open", () => {
    expect(
      gateRequirements(link({ requireEmail: false, allowedEmails: null })),
    ).toEqual({ passcode: false, email: false });
  });
});

describe("verifyShareAttempt — passcode", () => {
  it("does not call a passcode wrong before one has been typed", () => {
    const guarded = link({ passcodeHash: "scrypt$x$y" });
    const first = verifyShareAttempt(guarded, { passcodeOk: false, email: null }, NOW);
    expect(first).toEqual({ ok: false, reason: "passcode_needed" });
    expect(refusalMessage("passcode_needed")).not.toMatch(/not right/i);
  });

  it("refuses a wrong passcode and allows a right one", () => {
    const guarded = link({ passcodeHash: "scrypt$x$y" });
    expect(
      verifyShareAttempt(
        guarded,
        { passcodeOk: false, passcodeAttempted: true, email: "a@b.test" },
        NOW,
      ),
    ).toEqual({ ok: false, reason: "passcode" });
    expect(
      verifyShareAttempt(guarded, { passcodeOk: true, email: "a@b.test" }, NOW).ok,
    ).toBe(true);
  });
});

describe("verifyShareAttempt — identifying the viewer", () => {
  it("requires an email when the link asks for one", () => {
    expect(verifyShareAttempt(link(), gave(null), NOW)).toEqual({
      ok: false,
      reason: "email_required",
    });
    expect(verifyShareAttempt(link(), gave("   "), NOW).ok).toBe(false);
    expect(verifyShareAttempt(link(), gave("not-an-email"), NOW).ok).toBe(false);
  });

  it("records the address in normalised form", () => {
    const verdict = verifyShareAttempt(link(), gave("  Vendor@Example.COM "), NOW);
    expect(verdict).toEqual({ ok: true, viewerEmail: "vendor@example.com" });
  });

  it("opens without an email only when neither gate is set", () => {
    const open = link({ requireEmail: false, allowedEmails: null });
    expect(verifyShareAttempt(open, gave(null), NOW)).toEqual({
      ok: true,
      viewerEmail: null,
    });
  });

  it("still asks for an email when an allowlist exists, even if requireEmail is off", () => {
    // an allowlist is meaningless without knowing who is asking
    const listed = link({ requireEmail: false, allowedEmails: ["a@b.test"] });
    expect(verifyShareAttempt(listed, gave(null), NOW)).toEqual({
      ok: false,
      reason: "email_required",
    });
  });

  it("refuses an address that is not on the allowlist", () => {
    const listed = link({ allowedEmails: ["Vendor@Example.com"] });
    expect(verifyShareAttempt(listed, gave("other@example.com"), NOW)).toEqual({
      ok: false,
      reason: "email_not_allowed",
    });
    // case and spacing must not decide access
    expect(verifyShareAttempt(listed, gave(" VENDOR@example.COM "), NOW).ok).toBe(true);
  });
});

describe("resolveExpiry", () => {
  it("bounds the range instead of trusting the input", () => {
    expect(resolveExpiry(0, NOW).getTime()).toBe(NOW.getTime() + 86_400_000);
    expect(resolveExpiry(9999, NOW).getTime()).toBe(
      NOW.getTime() + MAX_EXPIRY_DAYS * 86_400_000,
    );
    expect(resolveExpiry(-5, NOW).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("has a sane default and refuses nonsense", () => {
    expect(DEFAULT_EXPIRY_DAYS).toBe(14);
    expect(() => resolveExpiry(NaN, NOW)).toThrow();
  });
});

describe("parseAllowedEmails", () => {
  it("splits on commas, semicolons and whitespace, and dedupes", () => {
    expect(parseAllowedEmails("a@b.test, A@B.test;  c@d.test")).toEqual([
      "a@b.test",
      "c@d.test",
    ]);
  });

  it("returns null for an empty box, meaning anyone who identifies themselves", () => {
    expect(parseAllowedEmails("   ")).toBeNull();
  });

  it("names a bad address rather than silently dropping it", () => {
    expect(() => parseAllowedEmails("a@b.test, oops")).toThrow(/oops/);
  });
});

describe("wording", () => {
  it("never mentions the file, even when the link is dead", () => {
    for (const reason of ["unknown", "passcode", "passcode_needed", "email_required", "email_not_allowed"] as const) {
      const text = refusalMessage(reason).toLowerCase();
      expect(text).not.toMatch(/file|document name|contract/);
    }
  });
});

describe("email helpers", () => {
  it("normalises and validates", () => {
    expect(normaliseEmail(" A@B.test ")).toBe("a@b.test");
    expect(isPlausibleEmail("a@b.test")).toBe(true);
    expect(isPlausibleEmail("a@b")).toBe(false);
    expect(isPlausibleEmail("a b@c.test")).toBe(false);
  });
});
