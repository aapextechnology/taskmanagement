import { describe, expect, it } from "vitest";
import {
  bottleneckLevel,
  decideBump,
  type BumpState,
} from "./bottleneck-math";

describe("bottleneckLevel (Owner threshold: ≥3, or ≥1 + overdue/blocked)", () => {
  it("no waiters = never a bottleneck, even when overdue or blocked", () => {
    expect(bottleneckLevel({ openWaiters: 0, overdue: true, blocked: true })).toBe("none");
  });
  it("1–2 waiters on a healthy task = plain bottleneck (grey)", () => {
    expect(bottleneckLevel({ openWaiters: 1, overdue: false, blocked: false })).toBe("bottleneck");
    expect(bottleneckLevel({ openWaiters: 2, overdue: false, blocked: false })).toBe("bottleneck");
  });
  it("3+ waiters = critical regardless of the task's own state", () => {
    expect(bottleneckLevel({ openWaiters: 3, overdue: false, blocked: false })).toBe("critical");
    expect(bottleneckLevel({ openWaiters: 7, overdue: false, blocked: false })).toBe("critical");
  });
  it("1 waiter + blocker overdue or blocked = critical", () => {
    expect(bottleneckLevel({ openWaiters: 1, overdue: true, blocked: false })).toBe("critical");
    expect(bottleneckLevel({ openWaiters: 1, overdue: false, blocked: true })).toBe("critical");
  });
});

const state = (over: Partial<BumpState> = {}): BumpState => ({
  priority: "medium",
  priorityBeforeAuto: null,
  autoUrgentAt: null,
  ...over,
});
const NOW = new Date("2026-08-07T10:00:00Z");

describe("decideBump (auto-bump with revert + manual-override guard)", () => {
  it("bumps to urgent on critical, remembering the old priority", () => {
    const action = decideBump("critical", state({ priority: "high" }), NOW);
    expect(action).toEqual({
      kind: "bump",
      set: { priority: "urgent", priorityBeforeAuto: "high", autoUrgentAt: NOW },
    });
  });

  it("does nothing when a human already set urgent (no flags, no takeover)", () => {
    expect(decideBump("critical", state({ priority: "urgent" }), NOW)).toEqual({ kind: "none" });
  });

  it("does nothing while still critical after our own bump", () => {
    const bumped = state({ priority: "urgent", priorityBeforeAuto: "low", autoUrgentAt: NOW });
    expect(decideBump("critical", bumped, NOW)).toEqual({ kind: "none" });
  });

  it("reverts to the stored priority when the bottleneck clears", () => {
    const bumped = state({ priority: "urgent", priorityBeforeAuto: "low", autoUrgentAt: NOW });
    expect(decideBump("none", bumped, NOW)).toEqual({
      kind: "revert",
      set: { priority: "low", priorityBeforeAuto: null, autoUrgentAt: null },
    });
    // plain bottleneck (1–2 waiters) is also below the bump bar → revert
    expect(decideBump("bottleneck", bumped, NOW).kind).toBe("revert");
  });

  it("manual change after the bump wins — flags clear, priority untouched", () => {
    const overridden = state({ priority: "high", priorityBeforeAuto: "low", autoUrgentAt: NOW });
    expect(decideBump("none", overridden, NOW)).toEqual({
      kind: "clear",
      set: { priorityBeforeAuto: null, autoUrgentAt: null },
    });
  });

  it("never touches an unbumped, non-critical task", () => {
    expect(decideBump("none", state(), NOW)).toEqual({ kind: "none" });
    expect(decideBump("bottleneck", state(), NOW)).toEqual({ kind: "none" });
  });
});
