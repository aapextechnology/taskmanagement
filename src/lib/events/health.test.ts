import { describe, expect, it } from "vitest";
import { computeHealth } from "./health";

const clean = { overdueTasks: 0, blockedOnCriticalPath: false };

describe("computeHealth", () => {
  it("ON TRACK with no negative signals", () => {
    expect(computeHealth(clean)).toBe("on_track");
    expect(
      computeHealth({ ...clean, budgetTotal: 100, budgetCommitted: 50, budgetActual: 20 }),
    ).toBe("on_track");
  });

  it("AT RISK on any overdue task", () => {
    expect(computeHealth({ ...clean, overdueTasks: 1 })).toBe("at_risk");
    expect(computeHealth({ ...clean, overdueTasks: 4 })).toBe("at_risk");
  });

  it("AT RISK when committed exceeds 90% of budget", () => {
    expect(
      computeHealth({ ...clean, budgetTotal: 100, budgetCommitted: 91 }),
    ).toBe("at_risk");
    expect(
      computeHealth({ ...clean, budgetTotal: 100, budgetCommitted: 90 }),
    ).toBe("on_track");
  });

  it("CRITICAL at the overdue threshold (default 5)", () => {
    expect(computeHealth({ ...clean, overdueTasks: 5 })).toBe("critical");
  });

  it("CRITICAL when a blocked task sits on the critical path", () => {
    expect(computeHealth({ ...clean, blockedOnCriticalPath: true })).toBe("critical");
  });

  it("CRITICAL when actual spend exceeds total budget", () => {
    expect(
      computeHealth({ ...clean, budgetTotal: 100, budgetActual: 101 }),
    ).toBe("critical");
  });

  it("no budget set disables budget signals entirely", () => {
    expect(
      computeHealth({ ...clean, budgetCommitted: 999, budgetActual: 999 }),
    ).toBe("on_track");
  });

  it("critical outranks at-risk when both apply", () => {
    expect(
      computeHealth({ ...clean, overdueTasks: 2, blockedOnCriticalPath: true }),
    ).toBe("critical");
  });

  it("honors a custom overdue threshold", () => {
    expect(
      computeHealth({ ...clean, overdueTasks: 2 }, { overdueCritical: 2, committedRatioAtRisk: 0.9 }),
    ).toBe("critical");
  });
});
