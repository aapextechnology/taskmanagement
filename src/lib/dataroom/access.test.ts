import { describe, expect, it } from "vitest";
import {
  allowedChildLevels,
  canNest,
  DEFAULT_VISIBILITY,
  resolveFolderAccess,
  wouldOrphan,
  wouldOrphanByDowngrade,
  type AccessSubject,
  type FolderNode,
  type Visibility,
} from "./access";

const OWNER: AccessSubject = { id: "u-owner", role: "owner", divisionIds: [], canViewEvent: true };
const ADMIN: AccessSubject = { id: "u-admin", role: "admin", divisionIds: [], canViewEvent: true };
const PROD: AccessSubject = { id: "u-prod", role: "member", divisionIds: ["production"], canViewEvent: true };
const MKT: AccessSubject = { id: "u-mkt", role: "member", divisionIds: ["marketing"], canViewEvent: true };
const OUTSIDER: AccessSubject = { id: "u-out", role: "member", divisionIds: ["finance"], canViewEvent: false };
const GUEST: AccessSubject = { id: "u-guest", role: "external", divisionIds: [], canViewEvent: true };

function folder(over: Partial<FolderNode> = {}): FolderNode {
  return {
    id: "f1",
    visibility: "event",
    divisionId: null,
    createdBy: "u-prod",
    members: [],
    ...over,
  };
}

describe("canNest — a sub-folder may only narrow", () => {
  it("allows equal or tighter", () => {
    expect(canNest("organisation", "event")).toBe(true);
    expect(canNest("event", "event")).toBe(true);
    expect(canNest("division", "sealed")).toBe(true);
  });

  it("refuses widening, which would leak a sealed parent", () => {
    expect(canNest("sealed", "organisation")).toBe(false);
    expect(canNest("sealed", "event")).toBe(false);
    expect(canNest("division", "event")).toBe(false);
    expect(canNest("event", "organisation")).toBe(false);
  });

  it("offers only the legal levels for a child", () => {
    expect(allowedChildLevels("sealed")).toEqual(["sealed"]);
    expect(allowedChildLevels("division")).toEqual(["sealed", "division"]);
    expect(allowedChildLevels("organisation")).toHaveLength(4);
  });

  it("defaults a new folder to event level", () => {
    expect(DEFAULT_VISIBILITY).toBe<Visibility>("event");
  });
});

describe("external users", () => {
  it("reach no part of the dataroom, at any level", () => {
    for (const visibility of ["organisation", "event", "division", "sealed"] as Visibility[]) {
      const node = folder({ visibility, divisionId: "production", members: [{ userId: GUEST.id, canEdit: true }] });
      expect(resolveFolderAccess(GUEST, [node]).canView).toBe(false);
    }
  });
});

describe("organisation level", () => {
  it("is readable by any internal user, even one outside the event", () => {
    expect(resolveFolderAccess(OUTSIDER, [folder({ visibility: "organisation" })]).canView).toBe(true);
  });
});

describe("event level", () => {
  it("follows whether the person can view the event", () => {
    expect(resolveFolderAccess(PROD, [folder()]).canView).toBe(true);
    expect(resolveFolderAccess(OUTSIDER, [folder()]).canView).toBe(false);
  });
});

describe("division level", () => {
  const div = folder({ visibility: "division", divisionId: "production" });

  it("admits that division's members", () => {
    expect(resolveFolderAccess(PROD, [div]).canView).toBe(true);
  });

  it("keeps another division out", () => {
    expect(resolveFolderAccess(MKT, [div]).canView).toBe(false);
  });

  it("is visible to Owner and Admin, consistent with org.viewAllDivisions", () => {
    expect(resolveFolderAccess(OWNER, [div]).canView).toBe(true);
    expect(resolveFolderAccess(ADMIN, [div]).canView).toBe(true);
  });

  it("admits nobody when the division was never set", () => {
    const broken = folder({ visibility: "division", divisionId: null });
    expect(resolveFolderAccess(PROD, [broken]).canView).toBe(false);
  });
});

describe("sealed level", () => {
  const sealed = folder({
    visibility: "sealed",
    members: [{ userId: PROD.id, canEdit: false }],
  });

  it("admits only the people named on it", () => {
    expect(resolveFolderAccess(PROD, [sealed]).canView).toBe(true);
    expect(resolveFolderAccess(MKT, [sealed]).canView).toBe(false);
  });

  it("does NOT admit the Owner or Admin automatically", () => {
    // the whole point: restricted that leadership can read anyway is not
    // restricted, and these folders hold contracts and settlement figures
    expect(resolveFolderAccess(OWNER, [sealed]).canView).toBe(false);
    expect(resolveFolderAccess(ADMIN, [sealed]).canView).toBe(false);
  });

  it("admits the Owner once explicitly added", () => {
    const withOwner = folder({
      visibility: "sealed",
      members: [{ userId: OWNER.id, canEdit: true }],
    });
    expect(resolveFolderAccess(OWNER, [withOwner]).canView).toBe(true);
  });

  it("grants read without write unless canEdit is set", () => {
    expect(resolveFolderAccess(PROD, [sealed]).canUpload).toBe(false);
    const writable = folder({
      visibility: "sealed",
      members: [{ userId: PROD.id, canEdit: true }],
    });
    expect(resolveFolderAccess(PROD, [writable]).canUpload).toBe(true);
  });
});

describe("the ancestor chain", () => {
  it("refuses a child when an ancestor refuses, even if the child alone would allow", () => {
    // a row that predates the narrow-only rule, or arrives by import, must
    // not become a way in
    const chain = [
      folder({ id: "root", visibility: "sealed", members: [] }),
      folder({ id: "child", visibility: "organisation" }),
    ];
    expect(resolveFolderAccess(PROD, chain).canView).toBe(false);
    expect(resolveFolderAccess(OWNER, chain).canView).toBe(false);
  });

  it("allows when every level in the chain allows", () => {
    const chain = [
      folder({ id: "root", visibility: "event" }),
      folder({ id: "child", visibility: "division", divisionId: "production" }),
    ];
    expect(resolveFolderAccess(PROD, chain).canView).toBe(true);
    expect(resolveFolderAccess(MKT, chain).canView).toBe(false);
  });

  it("keeps a sealed ancestor's write rule for the child", () => {
    const chain = [
      folder({ id: "root", visibility: "sealed", members: [{ userId: PROD.id, canEdit: true }] }),
      folder({ id: "child", visibility: "sealed", members: [{ userId: PROD.id, canEdit: false }] }),
    ];
    const access = resolveFolderAccess(PROD, chain);
    expect(access.canView).toBe(true);
    expect(access.canUpload).toBe(false); // the child grants read only
  });

  it("denies an empty chain rather than defaulting open", () => {
    expect(resolveFolderAccess(OWNER, []).canView).toBe(false);
  });
});

describe("management rights", () => {
  it("belong to Owner/Admin and to the folder's creator", () => {
    const f = folder({ createdBy: PROD.id });
    expect(resolveFolderAccess(OWNER, [f]).canManage).toBe(true);
    expect(resolveFolderAccess(PROD, [f]).canManage).toBe(true);
    expect(resolveFolderAccess(MKT, [f]).canManage).toBe(false);
  });

  it("follow the edit grant inside a sealed folder, not who created it", () => {
    // otherwise removing the creator strands the folder: an editor remains
    // but nobody can manage the list, and an Owner cannot step in because a
    // sealed folder is invisible to them
    const sealed = folder({
      visibility: "sealed",
      createdBy: OWNER.id,
      members: [
        { userId: MKT.id, canEdit: true },
        { userId: PROD.id, canEdit: false },
      ],
    });
    expect(resolveFolderAccess(MKT, [sealed]).canManage).toBe(true);
    expect(resolveFolderAccess(PROD, [sealed]).canManage).toBe(false);
  });

  it("never exceed what the person can even see", () => {
    const sealed = folder({ visibility: "sealed", createdBy: OWNER.id, members: [] });
    // the Owner created it but is not on the list — no sight, so no control
    expect(resolveFolderAccess(OWNER, [sealed]).canManage).toBe(false);
  });
});

describe("orphan guards", () => {
  const editor = { userId: "a", canEdit: true };
  const reader = { userId: "b", canEdit: false };

  it("refuses to remove the last person who can manage the folder", () => {
    // a sealed folder admits only its list, so an all-readers list is
    // unreachable forever — not even an Owner could repair it
    expect(wouldOrphan([editor], "a")).toBe(true);
    expect(wouldOrphan([editor, reader], "a")).toBe(true);
  });

  it("allows removing someone while another editor remains", () => {
    expect(wouldOrphan([editor, { userId: "c", canEdit: true }], "a")).toBe(false);
    expect(wouldOrphan([editor, reader], "b")).toBe(false);
  });

  it("treats an empty list as already orphaned", () => {
    expect(wouldOrphan([], "a")).toBe(true);
  });

  it("catches the same trap via a downgrade, not just a removal", () => {
    expect(wouldOrphanByDowngrade([editor], "a")).toBe(true);
    expect(wouldOrphanByDowngrade([editor, { userId: "c", canEdit: true }], "a")).toBe(
      false,
    );
  });
});
