import { describe, expect, it } from "vitest";
import { canRestrictTask, canSeeTask, type TaskFacts, type TaskSubject } from "./visibility";

const staffProd: TaskSubject = { id: "u-prod", role: "member", divisionIds: ["production"], headOf: [] };
const headProd: TaskSubject = { id: "u-head", role: "member", divisionIds: ["production"], headOf: ["production"] };
const staffMkt: TaskSubject = { id: "u-mkt", role: "member", divisionIds: ["marketing"], headOf: [] };
const owner: TaskSubject = { id: "u-own", role: "owner", divisionIds: [], headOf: [] };
const guest: TaskSubject = { id: "u-ext", role: "external", divisionIds: [], headOf: [] };

const task = (over: Partial<TaskFacts> = {}): TaskFacts => ({
  divisionId: "production",
  restricted: false,
  leadId: null,
  assigneeIds: [],
  ...over,
});

describe("the new default: open across divisions", () => {
  it("lets another division see an ordinary task", () => {
    expect(canSeeTask(staffMkt, task())).toBe(true);
  });

  it("still keeps externals out", () => {
    expect(canSeeTask(guest, task())).toBe(false);
  });
});

describe("a sealed task", () => {
  const sealed = task({ restricted: true });

  it("hides from another division", () => {
    expect(canSeeTask(staffMkt, sealed)).toBe(false);
  });

  it("stays visible inside its own division", () => {
    expect(canSeeTask(staffProd, sealed)).toBe(true);
  });

  it("is still visible to leadership", () => {
    expect(canSeeTask(owner, sealed)).toBe(true);
  });

  it("reaches the people doing it, whatever division they are in", () => {
    // otherwise assigning across divisions creates work its owner cannot
    // open — which reads as a bug and gets worked around
    expect(canSeeTask(staffMkt, task({ restricted: true, leadId: staffMkt.id }))).toBe(true);
    expect(canSeeTask(staffMkt, task({ restricted: true, assigneeIds: [staffMkt.id] }))).toBe(true);
    expect(
      canSeeTask(staffMkt, task({ restricted: true, watcherIds: [staffMkt.id] })),
    ).toBe(true);
  });
});

describe("who may seal a task", () => {
  it("is the head of that division, and leadership", () => {
    expect(canRestrictTask(headProd, "production")).toBe(true);
    expect(canRestrictTask(owner, "production")).toBe(true);
  });

  it("is not ordinary staff — hiding work is a management decision", () => {
    expect(canRestrictTask(staffProd, "production")).toBe(false);
  });

  it("is not a head of some other division", () => {
    expect(canRestrictTask(headProd, "marketing")).toBe(false);
  });
});
