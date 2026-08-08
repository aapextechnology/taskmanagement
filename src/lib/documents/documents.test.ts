import { describe, expect, it } from "vitest";
import { can, type Actor, type Capability } from "@/lib/permissions";
import {
  DOCUMENT_CATEGORIES,
  documentDownloadHref,
  filterDocuments,
  visibleDocuments,
  type DocumentRecord,
} from "./logic";

// EPIC-008 T-082 — Document library.
// Section A exercises `document.view` / `document.manage` through the
// central `can` (@/lib/permissions) — these capabilities do not exist on
// the Capability union yet, so `as Capability` forward-declares the literal
// until src/lib/permissions/index.ts is extended (GREEN phase, reviewed
// task only — this file never edits that protected module).
// Section B exercises the pure helpers in ./logic (created in GREEN).

const DOCUMENT_VIEW = "document.view" as Capability;
const DOCUMENT_MANAGE = "document.manage" as Capability;

// ---- Section A fixtures ---------------------------------------------------
// Mirrors src/lib/permissions/permissions.test.ts fixture style.

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
const headLogistics: Actor = {
  id: "u-head-log",
  role: "member",
  memberships: [{ divisionId: "logistics", role: "head" }],
};
const staffLogistics: Actor = {
  id: "u-staff-log",
  role: "member",
  memberships: [{ divisionId: "logistics", role: "staff" }],
};
const staffFinance: Actor = {
  id: "u-staff-fin",
  role: "member",
  memberships: [{ divisionId: "finance", role: "staff" }],
};
const memberNoDivision: Actor = { id: "u-lone", role: "member", memberships: [] };
// External actors — one with a (hypothetical) matching membership entry, one
// without. Both must be denied: externals see no documents, period.
const externalWithMembership: Actor = {
  id: "u-ext-member",
  role: "external",
  memberships: [{ divisionId: "production", role: "staff" }],
};
const externalNoMembership: Actor = { id: "u-ext", role: "external", memberships: [] };

const production = { divisionId: "production" };

describe("document.view (@/lib/permissions can)", () => {
  it("owner and admin PASS for any division", () => {
    for (const actor of [owner, admin]) {
      expect(can(actor, DOCUMENT_VIEW, production)).toBe(true);
    }
  });

  it("a head or staff member of the target division PASSes", () => {
    expect(can(headProduction, DOCUMENT_VIEW, production)).toBe(true);
    expect(can(staffProduction, DOCUMENT_VIEW, production)).toBe(true);
  });

  it("any actor holding org.viewAllDivisions PASSes regardless of division", () => {
    for (const actor of [owner, admin]) {
      expect(can(actor, "org.viewAllDivisions")).toBe(true);
      expect(can(actor, DOCUMENT_VIEW, { divisionId: "logistics" })).toBe(true);
    }
  });

  it("FAILS for a member whose memberships are all in OTHER divisions", () => {
    expect(can(staffFinance, DOCUMENT_VIEW, production)).toBe(false);
    expect(can(headLogistics, DOCUMENT_VIEW, production)).toBe(false);
  });

  it("FAILS for a member with no memberships at all", () => {
    expect(can(memberNoDivision, DOCUMENT_VIEW, production)).toBe(false);
  });

  it("FAILS for a plain member when ctx.divisionId is undefined", () => {
    expect(can(staffProduction, DOCUMENT_VIEW, {})).toBe(false);
    expect(can(staffProduction, DOCUMENT_VIEW)).toBe(false);
  });
});

describe("document.manage (@/lib/permissions can)", () => {
  it("owner, admin, head, and staff of the division PASS", () => {
    expect(can(owner, DOCUMENT_MANAGE, production)).toBe(true);
    expect(can(admin, DOCUMENT_MANAGE, production)).toBe(true);
    expect(can(headProduction, DOCUMENT_MANAGE, production)).toBe(true);
    expect(can(staffProduction, DOCUMENT_MANAGE, production)).toBe(true);
  });

  it("FAILS for a member of another division", () => {
    expect(can(staffFinance, DOCUMENT_MANAGE, production)).toBe(false);
    expect(can(headLogistics, DOCUMENT_MANAGE, production)).toBe(false);
  });

  it("FAILS for a member with no membership", () => {
    expect(can(memberNoDivision, DOCUMENT_MANAGE, production)).toBe(false);
  });
});

describe("external guests: document.view and document.manage are BOTH always false", () => {
  it("an external with a matching division membership entry is still denied", () => {
    expect(can(externalWithMembership, DOCUMENT_VIEW, production)).toBe(false);
    expect(can(externalWithMembership, DOCUMENT_MANAGE, production)).toBe(false);
  });

  it("an external with no membership at all is denied", () => {
    expect(can(externalNoMembership, DOCUMENT_VIEW, production)).toBe(false);
    expect(can(externalNoMembership, DOCUMENT_MANAGE, production)).toBe(false);
  });
});

// ---- Section B — pure helpers (src/lib/documents/logic.ts) ---------------

function makeDoc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    eventId: "event-1",
    divisionId: "production",
    category: "contract",
    title: "Venue contract",
    filePath: "documents/aaa.pdf",
    ...overrides,
  };
}

const docContractProduction = makeDoc({
  id: "doc-1",
  divisionId: "production",
  category: "contract",
  filePath: "documents/aaa.pdf",
});
const docPermitLogistics = makeDoc({
  id: "doc-2",
  divisionId: "logistics",
  category: "permit",
  filePath: "documents/bbb.pdf",
});
const docRiderFinance = makeDoc({
  id: "doc-3",
  divisionId: "finance",
  category: "rider",
  filePath: "documents/ccc.pdf",
});
const docStagePlotProduction = makeDoc({
  id: "doc-4",
  divisionId: "production",
  category: "stage_plot",
  filePath: "documents/ddd.pdf",
});

const allDocs: DocumentRecord[] = [
  docContractProduction,
  docPermitLogistics,
  docRiderFinance,
  docStagePlotProduction,
];

describe("DOCUMENT_CATEGORIES", () => {
  it("is exactly [contract, permit, rider, stage_plot], in that order", () => {
    expect(DOCUMENT_CATEGORIES).toEqual(["contract", "permit", "rider", "stage_plot"]);
  });
});

describe("filterDocuments", () => {
  it("no filter returns every document", () => {
    expect(filterDocuments(allDocs, {})).toEqual(allDocs);
  });

  it("filters by category", () => {
    expect(filterDocuments(allDocs, { category: "contract" })).toEqual([
      docContractProduction,
    ]);
  });

  it("filters by divisionId", () => {
    expect(filterDocuments(allDocs, { divisionId: "production" })).toEqual([
      docContractProduction,
      docStagePlotProduction,
    ]);
  });

  it("filters by category AND divisionId combined", () => {
    expect(
      filterDocuments(allDocs, { category: "stage_plot", divisionId: "production" }),
    ).toEqual([docStagePlotProduction]);
    // cross combination that matches nothing
    expect(
      filterDocuments(allDocs, { category: "permit", divisionId: "production" }),
    ).toEqual([]);
  });

  it("an unknown/invalid category value returns an empty list", () => {
    expect(
      filterDocuments(allDocs, { category: "invoice" as DocumentRecord["category"] }),
    ).toEqual([]);
  });
});

describe("visibleDocuments (uses can() internally)", () => {
  it("owner and admin see every document", () => {
    // owner/admin fixtures reused from Section A
    expect(visibleDocuments(owner, allDocs)).toEqual(allDocs);
    expect(visibleDocuments(admin, allDocs)).toEqual(allDocs);
  });

  it("a single-division member sees only their own division's documents", () => {
    const visible = visibleDocuments(staffProduction, allDocs);
    expect(visible).toEqual([docContractProduction, docStagePlotProduction]);
  });

  it("does NOT leak another division's document to a member (logistics must not see finance)", () => {
    const visible = visibleDocuments(staffLogistics, allDocs);
    expect(visible).toEqual([docPermitLogistics]);
    expect(visible.some((d) => d.id === docRiderFinance.id)).toBe(false);
    expect(visible.some((d) => d.divisionId === "finance")).toBe(false);
  });

  it("external guests see NONE, even with a matching membership entry", () => {
    expect(visibleDocuments(externalWithMembership, allDocs)).toEqual([]);
    expect(visibleDocuments(externalNoMembership, allDocs)).toEqual([]);
  });
});

describe("documentDownloadHref", () => {
  it("returns /api/files/<filePath> for a well-formed path", () => {
    expect(documentDownloadHref(docContractProduction)).toBe(
      "/api/files/documents/aaa.pdf",
    );
  });

  it("rejects a filePath containing a .. traversal segment", () => {
    const malicious = makeDoc({ filePath: "documents/../../etc/passwd" });
    expect(() => documentDownloadHref(malicious)).toThrow();
  });

  it("rejects a filePath with a leading slash (absolute path)", () => {
    const malicious = makeDoc({ filePath: "/etc/passwd" });
    expect(() => documentDownloadHref(malicious)).toThrow();
  });
});
