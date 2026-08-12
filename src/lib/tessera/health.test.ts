import { describe, expect, it } from "vitest";
import { apiHealth } from "./health";

const base = { configured: true, daysLeft: 4, lastOkAt: "2026-08-13T03:00:00Z", lastError: null };

describe("apiHealth", () => {
  it("no token → off", () => {
    expect(apiHealth({ configured: false, daysLeft: null, lastOkAt: null, lastError: null }).state).toBe("off");
  });

  it("healthy sync inside the lifetime → live", () => {
    expect(apiHealth(base).state).toBe("live");
  });

  it("countdown at zero beats a recent OK — the token is dead regardless", () => {
    expect(apiHealth({ ...base, daysLeft: 0 }).state).toBe("expired");
    expect(apiHealth({ ...base, daysLeft: -2 }).state).toBe("expired");
  });

  it("last day → expiring warning, still live", () => {
    expect(apiHealth({ ...base, daysLeft: 1 }).state).toBe("expiring");
  });

  it("stored 401 → expired, with the re-paste instruction", () => {
    const h = apiHealth({ ...base, lastError: "Tessera token expired or invalid (401)." });
    expect(h.state).toBe("expired");
    expect(h.detail).toContain("Admin");
  });

  it("non-auth failure → error, message surfaced verbatim", () => {
    const h = apiHealth({ ...base, lastError: "Tessera answered 500 for /eo/events." });
    expect(h.state).toBe("error");
    expect(h.detail).toContain("500");
  });

  it("token pasted but never tested → not verified, not 'live'", () => {
    const h = apiHealth({ ...base, lastOkAt: null });
    expect(h.state).toBe("error");
    expect(h.label).toMatch(/verified/i);
  });
});
