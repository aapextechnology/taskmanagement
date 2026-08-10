import { describe, expect, it } from "vitest";
import {
  autoUrgentReason,
  manualUrgentReason,
  taskAssignedLeadMessage,
  taskAssignedMemberMessage,
  taskUrgentMessage,
} from "./templates";

const base = {
  recipientName: "Budi Santoso",
  taskTitle: "Book the sound engineer",
  eventName: "Jakarta Fest 2026",
  url: "https://example.test/tasks/abc-123",
};

describe("assignment templates", () => {
  it("greets by first name and carries task, event and link", () => {
    const text = taskAssignedMemberMessage(base);
    expect(text).toContain("Hi Budi,");
    expect(text).not.toContain("Santoso");
    expect(text).toContain("Book the sound engineer");
    expect(text).toContain("Jakarta Fest 2026");
    expect(text).toContain("https://example.test/tasks/abc-123");
  });

  it("distinguishes the lead/PIC message from the member message", () => {
    expect(taskAssignedLeadMessage(base)).toContain("lead (PIC)");
    expect(taskAssignedMemberMessage(base)).toContain("assigned a task");
    expect(taskAssignedMemberMessage(base)).not.toContain("lead (PIC)");
  });

  it("falls back to a neutral greeting when the name is blank", () => {
    expect(taskAssignedMemberMessage({ ...base, recipientName: "  " })).toContain(
      "Hi there,",
    );
  });

  it("keeps a single-word name intact", () => {
    expect(taskAssignedLeadMessage({ ...base, recipientName: "Sri" })).toContain(
      "Hi Sri,",
    );
  });
});

describe("urgent template", () => {
  it("states the escalation, the reason and the link", () => {
    const text = taskUrgentMessage({ ...base, reason: "raised to urgent by Andi" });
    expect(text).toContain("*URGENT*");
    expect(text).toContain("Why: raised to urgent by Andi.");
    expect(text).toContain(base.url);
  });
});

describe("urgent reasons", () => {
  it("names the person who raised it by hand", () => {
    expect(manualUrgentReason("Andi")).toBe("raised to urgent by Andi");
  });

  it("stays readable when the actor name is missing", () => {
    expect(manualUrgentReason("  ")).toBe("raised to urgent");
  });

  it("singularises a lone waiter", () => {
    expect(autoUrgentReason({ waiters: 1, overdue: false })).toBe(
      "1 other task is waiting on it",
    );
  });

  it("pluralises and appends the overdue clause", () => {
    expect(autoUrgentReason({ waiters: 3, overdue: true })).toBe(
      "3 other tasks are waiting on it, and it is past its due date",
    );
  });
});
