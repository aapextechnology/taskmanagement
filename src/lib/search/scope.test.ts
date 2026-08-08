import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/permissions";
import { canSearch, visibleDivisionsFor } from "./scope";

const actor = (
  role: Actor["role"],
  memberships: Array<{ divisionId: string; role: "head" | "staff" }> = [],
): Actor => ({ id: "u1", role, memberships });

describe("global search scoping (T-102)", () => {
  it("owner and admin search every division", () => {
    expect(visibleDivisionsFor(actor("owner"))).toBeNull();
    expect(visibleDivisionsFor(actor("admin"))).toBeNull();
  });

  it("members are fenced to their own divisions", () => {
    const member = actor("member", [
      { divisionId: "production", role: "staff" },
      { divisionId: "logistics", role: "head" },
    ]);
    expect(visibleDivisionsFor(member)).toEqual(["production", "logistics"]);
  });

  it("a member with no memberships sees nothing", () => {
    expect(visibleDivisionsFor(actor("member"))).toEqual([]);
  });

  it("externals are locked out entirely", () => {
    const guest = actor("external", [
      { divisionId: "production", role: "staff" },
    ]);
    expect(visibleDivisionsFor(guest)).toEqual([]);
    expect(canSearch(guest)).toBe(false);
  });

  it("internal roles may search at all", () => {
    expect(canSearch(actor("owner"))).toBe(true);
    expect(canSearch(actor("admin"))).toBe(true);
    expect(canSearch(actor("member"))).toBe(true);
  });
});
