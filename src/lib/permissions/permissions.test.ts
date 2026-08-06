import { describe, expect, it } from "vitest";
import {
  assertCan,
  can,
  canDecideApprovalStep,
  PermissionError,
  type Actor,
} from "./index";

// Fixtures mirror the seeded demo org: production, marketing, finance.
const owner: Actor = { id: "u-owner", role: "owner", memberships: [] };
const admin: Actor = { id: "u-admin", role: "admin", memberships: [] };
const headProduction: Actor = {
  id: "u-head-prod",
  role: "member",
  memberships: [{ divisionId: "production", role: "head" }],
};
const staffProduction: Actor = {
  id: "u-staff-prod",
  role: "member",
  memberships: [{ divisionId: "production", role: "staff" }],
};
const staffFinance: Actor = {
  id: "u-staff-fin",
  role: "member",
  memberships: [{ divisionId: "finance", role: "staff" }],
};
const memberNoDivision: Actor = { id: "u-lone", role: "member", memberships: [] };
const external: Actor = { id: "u-ext", role: "external", memberships: [] };

const prod = { divisionId: "production" };
const marketing = { divisionId: "marketing-communications" };

describe("org & events", () => {
  it("owner/admin manage org, create/archive events, view audit", () => {
    for (const actor of [owner, admin]) {
      expect(can(actor, "org.manage")).toBe(true);
      expect(can(actor, "event.create")).toBe(true);
      expect(can(actor, "event.archive")).toBe(true);
      expect(can(actor, "audit.view")).toBe(true);
      expect(can(actor, "org.viewAllDivisions")).toBe(true);
    }
  });

  it("heads and staff cannot manage org or events", () => {
    for (const actor of [headProduction, staffProduction, external]) {
      expect(can(actor, "org.manage")).toBe(false);
      expect(can(actor, "event.create")).toBe(false);
      expect(can(actor, "event.archive")).toBe(false);
      expect(can(actor, "audit.view")).toBe(false);
    }
  });

  it("phase advance + division roster: owner/admin only", () => {
    for (const cap of [
      "event.updatePhase",
      "event.manageDivisions",
      "event.manageWorkflow",
    ] as const) {
      expect(can(owner, cap)).toBe(true);
      expect(can(admin, cap)).toBe(true);
      expect(can(headProduction, cap)).toBe(false);
      expect(can(staffProduction, cap)).toBe(false);
      expect(can(external, cap)).toBe(false);
    }
  });

  it("event browsing: every internal user yes, external no", () => {
    for (const actor of [owner, admin, headProduction, staffProduction, memberNoDivision]) {
      expect(can(actor, "event.view")).toBe(true);
    }
    expect(can(external, "event.view")).toBe(false);
  });

  it("cross-division summary: owner/admin/heads yes, staff no", () => {
    expect(can(owner, "org.viewCrossDivisionSummary")).toBe(true);
    expect(can(headProduction, "org.viewCrossDivisionSummary")).toBe(true);
    expect(can(staffProduction, "org.viewCrossDivisionSummary")).toBe(false);
    expect(can(external, "org.viewCrossDivisionSummary")).toBe(false);
  });

  it("dashboard: owner and admin only", () => {
    expect(can(owner, "dashboard.view")).toBe(true);
    expect(can(admin, "dashboard.view")).toBe(true);
    expect(can(headProduction, "dashboard.view")).toBe(false);
    expect(can(staffProduction, "dashboard.view")).toBe(false);
  });
});

describe("tasks — division scoped", () => {
  it("division members work their own division's tasks", () => {
    for (const cap of [
      "task.viewDivision",
      "task.create",
      "task.edit",
      "task.assign",
    ] as const) {
      expect(can(headProduction, cap, prod)).toBe(true);
      expect(can(staffProduction, cap, prod)).toBe(true);
    }
  });

  it("CROSS-DIVISION access is denied for members", () => {
    for (const cap of [
      "task.viewDivision",
      "task.create",
      "task.edit",
      "task.assign",
    ] as const) {
      expect(can(headProduction, cap, marketing)).toBe(false);
      expect(can(staffProduction, cap, marketing)).toBe(false);
    }
  });

  it("a member with no division has no task powers anywhere", () => {
    expect(can(memberNoDivision, "task.create", prod)).toBe(false);
    expect(can(memberNoDivision, "task.viewDivision", prod)).toBe(false);
  });

  it("owner/admin reach every division's tasks", () => {
    expect(can(owner, "task.viewDivision", marketing)).toBe(true);
    expect(can(admin, "task.create", prod)).toBe(true);
  });

  it("assigned-task updates require actual assignment", () => {
    expect(can(staffProduction, "task.updateAssigned", { isAssigned: true })).toBe(true);
    expect(can(staffProduction, "task.updateAssigned", { isAssigned: false })).toBe(false);
    expect(can(staffProduction, "task.updateAssigned", {})).toBe(false);
  });

  it("handoffs: internal division members yes, external never", () => {
    expect(can(headProduction, "handoff.request", prod)).toBe(true);
    expect(can(staffProduction, "handoff.request", prod)).toBe(true);
    expect(can(staffProduction, "handoff.request", marketing)).toBe(false);
    expect(can(external, "handoff.request", prod)).toBe(false);
  });

  it("handoff decisions: receiving head or owner/admin only", () => {
    expect(can(headProduction, "handoff.decide", prod)).toBe(true);
    expect(can(owner, "handoff.decide", prod)).toBe(true);
    expect(can(admin, "handoff.decide", prod)).toBe(true);
    expect(can(staffProduction, "handoff.decide", prod)).toBe(false);
    expect(can(headProduction, "handoff.decide", marketing)).toBe(false);
    expect(can(external, "handoff.decide", prod)).toBe(false);
  });
});

describe("external collaboration", () => {
  it("external guests: assigned-task updates + form submission ONLY", () => {
    expect(can(external, "task.updateAssigned", { isAssigned: true })).toBe(true);
    expect(can(external, "form.submit")).toBe(true);
    // not assigned → nothing
    expect(can(external, "task.updateAssigned", { isAssigned: false })).toBe(false);
    // the rest of the world is closed
    expect(can(external, "task.viewDivision", prod)).toBe(false);
    expect(can(external, "budget.view", prod)).toBe(false);
    expect(can(external, "external.invite", prod)).toBe(false);
    expect(can(external, "submission.review", prod)).toBe(false);
    expect(can(external, "approve.tier1", prod)).toBe(false);
    expect(can(external, "expense.create", prod)).toBe(false);
  });

  it("internal users never submit external forms", () => {
    expect(can(owner, "form.submit")).toBe(false);
    expect(can(staffProduction, "form.submit")).toBe(false);
  });

  it("inviting externals: owner/admin/head of that division only", () => {
    expect(can(owner, "external.invite", prod)).toBe(true);
    expect(can(headProduction, "external.invite", prod)).toBe(true);
    expect(can(headProduction, "external.invite", marketing)).toBe(false);
    expect(can(staffProduction, "external.invite", prod)).toBe(false);
  });

  it("submission review: head, or staff only when assigned reviewer", () => {
    expect(can(headProduction, "submission.review", prod)).toBe(true);
    expect(
      can(staffProduction, "submission.review", { ...prod, isAssignedReviewer: true }),
    ).toBe(true);
    expect(can(staffProduction, "submission.review", prod)).toBe(false);
    expect(
      can(staffProduction, "submission.review", {
        ...marketing,
        isAssignedReviewer: true,
      }),
    ).toBe(false);
  });
});

describe("finance — the sharpest visibility rules", () => {
  it("owner/admin/finance-members see every division's budget", () => {
    expect(can(owner, "budget.view", marketing)).toBe(true);
    expect(can(admin, "budget.view", marketing)).toBe(true);
    expect(can(staffFinance, "budget.view", prod)).toBe(true);
    expect(can(staffFinance, "budget.view", marketing)).toBe(true);
  });

  it("a Head sees ONLY their own division's budget", () => {
    expect(can(headProduction, "budget.view", prod)).toBe(true);
    expect(can(headProduction, "budget.view", marketing)).toBe(false);
  });

  it("non-finance staff see no budgets at all — not even their own division", () => {
    expect(can(staffProduction, "budget.view", prod)).toBe(false);
  });

  it("expense requests: any division member in their division", () => {
    expect(can(staffProduction, "expense.create", prod)).toBe(true);
    expect(can(staffProduction, "expense.create", marketing)).toBe(false);
  });

  it("budget.manage + expense.markPaid: owner/admin/finance members only", () => {
    for (const cap of ["budget.manage", "expense.markPaid"] as const) {
      expect(can(owner, cap)).toBe(true);
      expect(can(admin, cap)).toBe(true);
      expect(can(staffFinance, cap)).toBe(true);
      expect(can(headProduction, cap)).toBe(false);
      expect(can(staffProduction, cap)).toBe(false);
      expect(can(external, cap)).toBe(false);
    }
  });
});

describe("approvals — Admin is deliberately powerless here", () => {
  it("tier-1: owner and the division's own head", () => {
    expect(can(owner, "approve.tier1", prod)).toBe(true);
    expect(can(headProduction, "approve.tier1", prod)).toBe(true);
  });

  it("tier-1 negatives: admin, cross-division head, staff", () => {
    expect(can(admin, "approve.tier1", prod)).toBe(false);
    expect(can(headProduction, "approve.tier1", marketing)).toBe(false);
    expect(can(staffProduction, "approve.tier1", prod)).toBe(false);
  });

  it("final approval: owner ALONE", () => {
    expect(can(owner, "approve.final")).toBe(true);
    expect(can(admin, "approve.final")).toBe(false);
    expect(can(headProduction, "approve.final")).toBe(false);
    expect(can(staffFinance, "approve.final")).toBe(false);
    expect(can(external, "approve.final")).toBe(false);
  });
});

describe("documents — division scoped (EPIC-008 T-082)", () => {
  it("document.view: owner/admin/org.viewAllDivisions holders reach any division", () => {
    expect(can(owner, "document.view", marketing)).toBe(true);
    expect(can(admin, "document.view", marketing)).toBe(true);
  });

  it("document.view: a head or staff member of the target division PASSes", () => {
    expect(can(headProduction, "document.view", prod)).toBe(true);
    expect(can(staffProduction, "document.view", prod)).toBe(true);
  });

  it("document.view: CROSS-DIVISION access is denied for members", () => {
    expect(can(headProduction, "document.view", marketing)).toBe(false);
    expect(can(staffProduction, "document.view", marketing)).toBe(false);
    expect(can(memberNoDivision, "document.view", prod)).toBe(false);
  });

  it("document.manage: owner, admin, head, and staff of the division PASS", () => {
    expect(can(owner, "document.manage", prod)).toBe(true);
    expect(can(admin, "document.manage", prod)).toBe(true);
    expect(can(headProduction, "document.manage", prod)).toBe(true);
    expect(can(staffProduction, "document.manage", prod)).toBe(true);
  });

  it("document.manage: CROSS-DIVISION access is denied for members", () => {
    expect(can(staffFinance, "document.manage", prod)).toBe(false);
    expect(can(memberNoDivision, "document.manage", prod)).toBe(false);
  });

  it("externals are denied both document.view and document.manage", () => {
    expect(can(external, "document.view", prod)).toBe(false);
    expect(can(external, "document.manage", prod)).toBe(false);
  });
});

describe("canDecideApprovalStep (EPIC-004)", () => {
  const headFinance: Actor = {
    id: "u-head-fin",
    role: "member",
    memberships: [{ divisionId: "finance", role: "head" }],
  };
  const headLegal: Actor = {
    id: "u-head-legal",
    role: "member",
    memberships: [{ divisionId: "legal-licensing", role: "head" }],
  };

  it("owner decides ANY step", () => {
    for (const step of ["division_head", "finance", "owner", "legal"] as const) {
      expect(canDecideApprovalStep(owner, step, "production")).toBe(true);
    }
  });

  it("admin decides NOTHING", () => {
    for (const step of ["division_head", "finance", "owner", "legal"] as const) {
      expect(canDecideApprovalStep(admin, step, "production")).toBe(false);
    }
  });

  it("division_head step: the origin division's head only", () => {
    expect(canDecideApprovalStep(headProduction, "division_head", "production")).toBe(true);
    expect(canDecideApprovalStep(headProduction, "division_head", "marketing-communications")).toBe(false);
    expect(canDecideApprovalStep(staffProduction, "division_head", "production")).toBe(false);
  });

  it("finance step: finance HEAD, not finance staff", () => {
    expect(canDecideApprovalStep(headFinance, "finance", "production")).toBe(true);
    expect(canDecideApprovalStep(staffFinance, "finance", "production")).toBe(false);
    expect(canDecideApprovalStep(headProduction, "finance", "production")).toBe(false);
  });

  it("owner step: nobody but the owner", () => {
    expect(canDecideApprovalStep(headFinance, "owner", "finance")).toBe(false);
    expect(canDecideApprovalStep(headLegal, "owner", "legal-licensing")).toBe(false);
  });

  it("legal step: legal head; external never anything", () => {
    expect(canDecideApprovalStep(headLegal, "legal", "production")).toBe(true);
    expect(canDecideApprovalStep(external, "division_head", "production")).toBe(false);
    expect(canDecideApprovalStep(external, "legal", "production")).toBe(false);
  });
});

describe("assertCan", () => {
  it("passes silently when allowed", () => {
    expect(() => assertCan(owner, "org.manage")).not.toThrow();
  });

  it("throws PermissionError naming the capability when denied", () => {
    expect(() => assertCan(staffProduction, "org.manage")).toThrow(PermissionError);
    expect(() => assertCan(staffProduction, "org.manage")).toThrow(/org\.manage/);
  });
});
