import { describe, expect, it } from "vitest";
import { seesAllEvents, seesNoEvents } from "./visibility-rules";
import type { Actor } from "@/lib/permissions";

function actor(role: Actor["role"], divisions: string[] = []): Actor {
  return {
    id: "u1",
    role,
    memberships: divisions.map((divisionId) => ({
      divisionId,
      role: "staff" as const,
    })),
  };
}

describe("seesAllEvents", () => {
  it("gives leadership the whole portfolio", () => {
    expect(seesAllEvents(actor("owner"))).toBe(true);
    expect(seesAllEvents(actor("admin"))).toBe(true);
  });

  it("keeps externals out entirely", () => {
    expect(seesNoEvents(actor("external"))).toBe(true);
    expect(seesNoEvents(actor("member", ["a"]))).toBe(false);
  });

  it("does not, for anyone else", () => {
    // a member with many divisions is still not leadership — their events
    // come from participation, not from the size of their membership list
    expect(seesAllEvents(actor("member", ["a", "b", "c"]))).toBe(false);
    expect(seesAllEvents(actor("external"))).toBe(false);
  });
});
