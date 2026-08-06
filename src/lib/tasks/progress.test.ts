import { describe, expect, it } from "vitest";
import { summarizeStatuses, summarizeTaskProgress } from "@/lib/tasks/progress";

describe("summarizeTaskProgress", () => {
  it("counts done against committed work only", () => {
    const p = summarizeTaskProgress({
      done: 3,
      todo: 1,
      in_progress: 1,
      backlog: 5,
    });
    // 3 of 5 committed — the 5 backlog items are not in the denominator
    expect(p.committed).toBe(5);
    expect(p.pct).toBe(60);
    expect(p.backlog).toBe(5);
    expect(p.total).toBe(10);
  });

  it("keeps blocked work in the denominator", () => {
    const p = summarizeTaskProgress({ done: 1, blocked: 1 });
    expect(p.pct).toBe(50);
  });

  it("excludes cancelled work from both sides", () => {
    const p = summarizeTaskProgress({ done: 2, todo: 2, cancelled: 6 });
    expect(p.committed).toBe(4);
    expect(p.pct).toBe(50);
    expect(p.cancelled).toBe(6);
  });

  it("reports no percentage when nothing is committed yet", () => {
    // the guard that stops a groomed-but-unstarted event reading 0% or 100%
    const p = summarizeTaskProgress({ backlog: 42 });
    expect(p.pct).toBeNull();
    expect(p.committed).toBe(0);
    expect(p.backlog).toBe(42);
  });

  it("reports no percentage for an event with no tasks at all", () => {
    const p = summarizeTaskProgress({});
    expect(p.pct).toBeNull();
    expect(p.total).toBe(0);
  });

  it("reports no percentage when every task was cancelled", () => {
    const p = summarizeTaskProgress({ cancelled: 4 });
    expect(p.pct).toBeNull();
    expect(p.committed).toBe(0);
  });

  it("reaches 100% while backlog remains, and still surfaces the backlog", () => {
    // the case the UI must not present as "finished"
    const p = summarizeTaskProgress({ done: 5, backlog: 200 });
    expect(p.pct).toBe(100);
    expect(p.backlog).toBe(200);
  });

  it("rounds to whole percent", () => {
    const p = summarizeTaskProgress({ done: 1, todo: 2 });
    expect(p.pct).toBe(33);
  });

  it("never exceeds 100", () => {
    const p = summarizeTaskProgress({ done: 7 });
    expect(p.pct).toBe(100);
  });

  it("summarizeStatuses agrees with the count form", () => {
    const statuses = [
      "done",
      "done",
      "todo",
      "backlog",
      "cancelled",
    ] as const;
    expect(summarizeStatuses([...statuses])).toEqual(
      summarizeTaskProgress({ done: 2, todo: 1, backlog: 1, cancelled: 1 }),
    );
  });
});
