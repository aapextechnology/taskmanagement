import { describe, expect, it } from "vitest";
import {
  buildGanttModel,
  wibDayIndex,
  type GanttDependency,
  type GanttTask,
} from "./schedule";

// T-080: pure Gantt scheduling — no DB/permission access here. Callers fetch
// already-permission-scoped tasks/dependencies for ONE event via the service
// layer and hand them to this module to compute bars/arrows/critical path.
// Mirrors the fixture style of src/lib/calendar/aggregate.test.ts (WIB
// conventions, explicit UTC instants so assertions are host-TZ independent).

function makeTask(overrides: Partial<GanttTask> = {}): GanttTask {
  return {
    id: "task-1",
    status: "todo",
    startDate: null,
    dueDate: null,
    ...overrides,
  };
}

function dep(taskId: string, dependsOnTaskId: string): GanttDependency {
  return { taskId, dependsOnTaskId };
}

describe("wibDayIndex", () => {
  it("assigns different WIB day indices across the 17:00Z rollover boundary", () => {
    const justBefore = new Date("2026-08-10T16:59:59Z"); // 2026-08-10 WIB
    const atRollover = new Date("2026-08-10T17:00:00Z"); // 2026-08-11 WIB

    const before = wibDayIndex(justBefore);
    const at = wibDayIndex(atRollover);

    expect(at - before).toBe(1);
  });

  it("is stable for two instants on the same WIB day", () => {
    const early = new Date("2026-08-10T01:00:00Z");
    const late = new Date("2026-08-10T16:00:00Z");

    expect(wibDayIndex(early)).toBe(wibDayIndex(late));
  });

  it("supports an explicit origin, returning the day offset from it", () => {
    const origin = new Date("2026-08-01T00:00:00Z");
    const tenDaysLater = new Date("2026-08-11T00:00:00Z");

    expect(wibDayIndex(tenDaysLater, origin)).toBe(10);
  });
});

describe("buildGanttModel — bars", () => {
  it("builds a bar spanning startDate..dueDate when both are set", () => {
    const task = makeTask({
      id: "t1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });

    const { bars, unscheduled } = buildGanttModel({
      tasks: [task],
      dependencies: [],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(bars).toHaveLength(1);
    expect(bars[0].taskId).toBe("t1");
    expect(bars[0].start.getTime()).toBe(task.startDate!.getTime());
    expect(bars[0].end.getTime()).toBe(task.dueDate!.getTime());
    expect(unscheduled).toHaveLength(0);
  });

  it("builds a single-day bar when only dueDate is set", () => {
    const task = makeTask({
      id: "t2",
      startDate: null,
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });

    const { bars } = buildGanttModel({
      tasks: [task],
      dependencies: [],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(bars).toHaveLength(1);
    expect(bars[0].start.getTime()).toBe(task.dueDate!.getTime());
    expect(bars[0].end.getTime()).toBe(task.dueDate!.getTime());
  });

  it("builds a single-day bar when only startDate is set", () => {
    const task = makeTask({
      id: "t3",
      startDate: new Date("2026-08-05T00:00:00Z"),
      dueDate: null,
    });

    const { bars } = buildGanttModel({
      tasks: [task],
      dependencies: [],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(bars).toHaveLength(1);
    expect(bars[0].start.getTime()).toBe(task.startDate!.getTime());
    expect(bars[0].end.getTime()).toBe(task.startDate!.getTime());
  });

  it("excludes tasks with neither date from bars, listing them in unscheduled", () => {
    const task = makeTask({ id: "t4", startDate: null, dueDate: null });

    const { bars, unscheduled } = buildGanttModel({
      tasks: [task],
      dependencies: [],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(bars).toHaveLength(0);
    expect(unscheduled).toEqual(["t4"]);
  });

  it("excludes cancelled tasks entirely (no bar, not unscheduled)", () => {
    const task = makeTask({
      id: "t5",
      status: "cancelled",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-05T00:00:00Z"),
    });

    const { bars, unscheduled } = buildGanttModel({
      tasks: [task],
      dependencies: [],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(bars).toHaveLength(0);
    expect(unscheduled).toHaveLength(0);
  });
});

describe("buildGanttModel — arrows", () => {
  it("produces one arrow from the blocker to the blocked task when both have bars", () => {
    const blocker = makeTask({
      id: "blocker",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-05T00:00:00Z"),
    });
    const blocked = makeTask({
      id: "blocked",
      startDate: new Date("2026-08-06T00:00:00Z"),
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });

    const { arrows } = buildGanttModel({
      tasks: [blocker, blocked],
      dependencies: [dep("blocked", "blocker")],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toEqual({ from: "blocker", to: "blocked" });
  });

  it("produces no arrow when one side of the dependency is unscheduled", () => {
    const blocker = makeTask({ id: "blocker", startDate: null, dueDate: null });
    const blocked = makeTask({
      id: "blocked",
      startDate: new Date("2026-08-06T00:00:00Z"),
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });

    const { arrows, unscheduled } = buildGanttModel({
      tasks: [blocker, blocked],
      dependencies: [dep("blocked", "blocker")],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(arrows).toHaveLength(0);
    expect(unscheduled).toEqual(["blocker"]);
  });
});

describe("buildGanttModel — critical path on parallel chains", () => {
  // Chain A: a1 -> a2 -> a3, a3 ends 2026-08-20 WIB.
  const a1 = makeTask({
    id: "a1",
    startDate: new Date("2026-08-01T00:00:00Z"),
    dueDate: new Date("2026-08-05T00:00:00Z"),
  });
  const a2 = makeTask({
    id: "a2",
    startDate: new Date("2026-08-06T00:00:00Z"),
    dueDate: new Date("2026-08-15T00:00:00Z"),
  });
  const a3 = makeTask({
    id: "a3",
    startDate: new Date("2026-08-16T00:00:00Z"),
    dueDate: new Date("2026-08-20T00:00:00Z"),
  });

  // Chain B: b1 -> b2, b2 ends 2026-08-25 WIB (later than a3).
  const b1 = makeTask({
    id: "b1",
    startDate: new Date("2026-08-01T00:00:00Z"),
    dueDate: new Date("2026-08-20T00:00:00Z"),
  });
  const b2 = makeTask({
    id: "b2",
    startDate: new Date("2026-08-21T00:00:00Z"),
    dueDate: new Date("2026-08-25T00:00:00Z"),
  });

  // Independent task c, ends 2026-08-18 (before both chain ends).
  const c = makeTask({
    id: "c",
    startDate: new Date("2026-08-14T00:00:00Z"),
    dueDate: new Date("2026-08-18T00:00:00Z"),
  });

  const dependencies: GanttDependency[] = [
    dep("a2", "a1"),
    dep("a3", "a2"),
    dep("b2", "b1"),
  ];

  it("picks the chain ending at the latest-finishing task, ordered first-to-last", () => {
    const { criticalTaskIds } = buildGanttModel({
      tasks: [a1, a2, a3, b1, b2, c],
      dependencies,
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(criticalTaskIds).toEqual(["b1", "b2"]);
  });

  it("does not mark the non-critical parallel chain or the independent task as critical", () => {
    const { criticalTaskIds } = buildGanttModel({
      tasks: [a1, a2, a3, b1, b2, c],
      dependencies,
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    for (const id of ["a1", "a2", "a3", "c"]) {
      expect(criticalTaskIds).not.toContain(id);
    }
  });

  it("still produces arrows for every dependency between two scheduled tasks", () => {
    const { arrows } = buildGanttModel({
      tasks: [a1, a2, a3, b1, b2, c],
      dependencies,
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(arrows).toHaveLength(3);
    expect(arrows).toEqual(
      expect.arrayContaining([
        { from: "a1", to: "a2" },
        { from: "a2", to: "a3" },
        { from: "b1", to: "b2" },
      ]),
    );
  });
});

describe("buildGanttModel — critical path tie-breaking", () => {
  it("breaks a tie on latest end by the chain with the longest total duration", () => {
    // Chain X: x1 (4 days) -> x2 (4 days), total 8 days, ends 2026-08-20.
    const x1 = makeTask({
      id: "x1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-05T00:00:00Z"),
    });
    const x2 = makeTask({
      id: "x2",
      startDate: new Date("2026-08-16T00:00:00Z"),
      dueDate: new Date("2026-08-20T00:00:00Z"),
    });

    // Chain Y: y1 (2 days) -> y2 (16 days), total 18 days, also ends 2026-08-20.
    const y1 = makeTask({
      id: "y1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-03T00:00:00Z"),
    });
    const y2 = makeTask({
      id: "y2",
      startDate: new Date("2026-08-04T00:00:00Z"),
      dueDate: new Date("2026-08-20T00:00:00Z"),
    });

    const { criticalTaskIds } = buildGanttModel({
      tasks: [x1, x2, y1, y2],
      dependencies: [dep("x2", "x1"), dep("y2", "y1")],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(criticalTaskIds).toEqual(["y1", "y2"]);
  });
});

describe("buildGanttModel — cancelled tasks break the chain", () => {
  it("excludes a cancelled task from bars/arrows/critical path, breaking the chain at that point", () => {
    // p1 -> p2 (cancelled) -> p3. p3 ends latest (2026-08-20), but its only
    // predecessor edge (p3 depends on p2) is invalid because p2 is cancelled,
    // so the chain cannot extend past p3.
    const p1 = makeTask({
      id: "p1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-05T00:00:00Z"),
    });
    const p2 = makeTask({
      id: "p2",
      status: "cancelled",
      startDate: new Date("2026-08-06T00:00:00Z"),
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });
    const p3 = makeTask({
      id: "p3",
      startDate: new Date("2026-08-11T00:00:00Z"),
      dueDate: new Date("2026-08-20T00:00:00Z"),
    });

    // Second chain that finishes earlier, so p3 remains the latest-ending
    // scheduled, non-cancelled, non-done task.
    const q1 = makeTask({
      id: "q1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-15T00:00:00Z"),
    });
    const q2 = makeTask({
      id: "q2",
      startDate: new Date("2026-08-16T00:00:00Z"),
      dueDate: new Date("2026-08-18T00:00:00Z"),
    });

    const dependencies: GanttDependency[] = [
      dep("p2", "p1"),
      dep("p3", "p2"),
      dep("q2", "q1"),
    ];

    const { bars, arrows, criticalTaskIds } = buildGanttModel({
      tasks: [p1, p2, p3, q1, q2],
      dependencies,
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    expect(bars.map((b) => b.taskId)).not.toContain("p2");
    expect(arrows).not.toContainEqual({ from: "p1", to: "p2" });
    expect(arrows).not.toContainEqual({ from: "p2", to: "p3" });

    expect(criticalTaskIds).toEqual(["p3"]);
  });
});

describe("buildGanttModel — done tasks are never critical", () => {
  it("skips a done task at the latest end, picking the latest chain among non-done tasks", () => {
    // d1 -> d2 (done), d2 ends latest overall (2026-08-30) but must be
    // excluded from the critical path because it's done.
    const d1 = makeTask({
      id: "d1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });
    const d2 = makeTask({
      id: "d2",
      status: "done",
      startDate: new Date("2026-08-11T00:00:00Z"),
      dueDate: new Date("2026-08-30T00:00:00Z"),
    });

    // e1 -> e2, ends 2026-08-20 — the latest-ending chain among non-done tasks.
    const e1 = makeTask({
      id: "e1",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-05T00:00:00Z"),
    });
    const e2 = makeTask({
      id: "e2",
      startDate: new Date("2026-08-06T00:00:00Z"),
      dueDate: new Date("2026-08-20T00:00:00Z"),
    });

    const { bars, criticalTaskIds } = buildGanttModel({
      tasks: [d1, d2, e1, e2],
      dependencies: [dep("d2", "d1"), dep("e2", "e1")],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    // done tasks still keep their bar
    expect(bars.map((b) => b.taskId)).toEqual(
      expect.arrayContaining(["d1", "d2"]),
    );

    expect(criticalTaskIds).toEqual(["e1", "e2"]);
    expect(criticalTaskIds).not.toContain("d1");
    expect(criticalTaskIds).not.toContain("d2");
  });
});

describe("buildGanttModel — WIB day boundary positioning", () => {
  it("positions bars for tasks due either side of the 17:00Z WIB rollover on different WIB days", () => {
    const beforeRollover = makeTask({
      id: "before",
      dueDate: new Date("2026-08-10T16:59:59Z"), // 2026-08-10 WIB
    });
    const atRollover = makeTask({
      id: "after",
      dueDate: new Date("2026-08-10T17:00:00Z"), // 2026-08-11 WIB
    });

    const { bars } = buildGanttModel({
      tasks: [beforeRollover, atRollover],
      dependencies: [],
      showDate: new Date("2026-09-01T00:00:00Z"),
    });

    const beforeBar = bars.find((b) => b.taskId === "before")!;
    const afterBar = bars.find((b) => b.taskId === "after")!;

    expect(wibDayIndex(afterBar.end) - wibDayIndex(beforeBar.end)).toBe(1);
  });
});

describe("buildGanttModel — cycle safety", () => {
  it("terminates and returns a deterministic result for a dependency cycle", () => {
    // Bad data: cyc-x depends on cyc-y AND cyc-y depends on cyc-x.
    const cycX = makeTask({
      id: "cyc-x",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-05T00:00:00Z"),
    });
    const cycY = makeTask({
      id: "cyc-y",
      startDate: new Date("2026-08-01T00:00:00Z"),
      dueDate: new Date("2026-08-10T00:00:00Z"),
    });

    const dependencies: GanttDependency[] = [
      dep("cyc-x", "cyc-y"),
      dep("cyc-y", "cyc-x"),
    ];

    const start = Date.now();
    const { criticalTaskIds } = buildGanttModel({
      tasks: [cycX, cycY],
      dependencies,
      showDate: new Date("2026-09-01T00:00:00Z"),
    });
    const elapsedMs = Date.now() - start;

    // Must terminate promptly (no infinite loop / stack overflow) and
    // produce a deterministic array. cyc-y ends latest (2026-08-10) so it's
    // the endpoint; walking back to cyc-x is followed once, then the cycle
    // back to the already-visited cyc-y is dropped rather than looped.
    expect(elapsedMs).toBeLessThan(1000);
    expect(Array.isArray(criticalTaskIds)).toBe(true);
    expect(criticalTaskIds).toEqual(["cyc-x", "cyc-y"]);
  });
});
