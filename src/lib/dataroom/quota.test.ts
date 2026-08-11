import { describe, expect, it } from "vitest";
import {
  crossesWarningLine,
  DEFAULT_QUOTA_BYTES,
  decideUpload,
  DISK_FLOOR_BYTES,
  formatBytes,
  isOverLimit,
  usage,
} from "./quota";

const GB = 1024 ** 3;
const ROOMY_DISK = 500 * GB;

describe("usage", () => {
  it("reports the ratio, remainder and level", () => {
    const u = usage(2 * GB, 10 * GB);
    expect(u.ratio).toBeCloseTo(0.2);
    expect(u.remainingBytes).toBe(8 * GB);
    expect(u.level).toBe("ok");
  });

  it("warns from 80% and not before", () => {
    expect(usage(7.99 * GB, 10 * GB).level).toBe("ok");
    expect(usage(8 * GB, 10 * GB).level).toBe("warning");
  });

  it("is full at the limit, not only past it", () => {
    expect(usage(10 * GB, 10 * GB).level).toBe("full");
    expect(usage(10 * GB, 10 * GB).remainingBytes).toBe(0);
  });

  it("does not report a negative remainder when a limit was lowered", () => {
    const u = usage(12 * GB, 10 * GB);
    expect(u.remainingBytes).toBe(0);
    expect(u.ratio).toBe(1);
    expect(u.level).toBe("full");
  });

  it("treats a zero limit as full rather than dividing by zero", () => {
    expect(usage(0, 0).level).toBe("full");
    expect(usage(0, 0).ratio).toBe(1);
  });
});

describe("crossesWarningLine", () => {
  it("fires only on the upload that crosses it", () => {
    expect(crossesWarningLine(7 * GB, 8.5 * GB, 10 * GB)).toBe(true);
    // already past the line — the alert must not repeat on every upload
    expect(crossesWarningLine(8.5 * GB, 9 * GB, 10 * GB)).toBe(false);
    expect(crossesWarningLine(1 * GB, 2 * GB, 10 * GB)).toBe(false);
  });

  it("stays quiet when there is no limit to cross", () => {
    expect(crossesWarningLine(0, 5 * GB, 0)).toBe(false);
  });
});

describe("decideUpload", () => {
  const base = { usedBytes: 0, limitBytes: 10 * GB, freeDiskBytes: ROOMY_DISK };

  it("allows a file that fits", () => {
    const v = decideUpload({ ...base, incomingBytes: 1 * GB });
    expect(v.ok).toBe(true);
    expect(v.ok === true && v.remainingAfter).toBe(9 * GB);
  });

  it("allows a file that exactly fills the quota", () => {
    expect(decideUpload({ ...base, incomingBytes: 10 * GB }).ok).toBe(true);
  });

  it("refuses one byte past the quota, with the real numbers", () => {
    const v = decideUpload({
      ...base,
      usedBytes: 9.6 * GB,
      incomingBytes: 1 * GB,
    });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toBe("quota");
    expect(v.ok === false && v.message).toContain("9.6 GB");
    expect(v.ok === false && v.message).toContain("10 GB");
  });

  it("refuses an empty file", () => {
    expect(decideUpload({ ...base, incomingBytes: 0 }).ok).toBe(false);
    expect(decideUpload({ ...base, incomingBytes: -5 }).ok).toBe(false);
    expect(decideUpload({ ...base, incomingBytes: NaN }).ok).toBe(false);
  });

  it("lets the disk floor override a healthy event quota", () => {
    // plenty of room in the event's own quota, but the server is nearly full
    const v = decideUpload({
      ...base,
      incomingBytes: 1 * GB,
      freeDiskBytes: DISK_FLOOR_BYTES + 0.5 * GB,
    });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toBe("disk");
  });

  it("checks the floor before the quota, so the message names the real cause", () => {
    const v = decideUpload({
      usedBytes: 9.9 * GB,
      limitBytes: 10 * GB,
      incomingBytes: 5 * GB,
      freeDiskBytes: 1 * GB,
    });
    expect(v.ok === false && v.reason).toBe("disk");
  });
});

describe("isOverLimit", () => {
  it("flags an event whose limit was lowered under its usage", () => {
    // the epic is explicit: this blocks new uploads, it never deletes
    expect(isOverLimit(12 * GB, 10 * GB)).toBe(true);
    expect(isOverLimit(10 * GB, 10 * GB)).toBe(false);
  });
});

describe("formatBytes", () => {
  it("scales and keeps one decimal where it matters", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1.5 * 1024 ** 2)).toBe("1.5 MB");
    expect(formatBytes(10 * GB)).toBe("10 GB");
  });

  it("does not print a decimal for large values or bytes", () => {
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(500 * GB)).toBe("500 GB");
  });

  it("survives nonsense rather than printing NaN", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
  });
});

describe("defaults", () => {
  it("matches the figures agreed in EPIC-017", () => {
    expect(DEFAULT_QUOTA_BYTES).toBe(10 * GB);
    expect(DISK_FLOOR_BYTES).toBe(50 * GB);
  });
});
