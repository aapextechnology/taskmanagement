import { describe, expect, it } from "vitest";
import { resolvePageAccess, type PageShareRow } from "./access";

const AUTHOR = { id: "u-author", role: "member", memberships: [] };
const OTHER = { id: "u-other", role: "member", memberships: [] };
const MARKETING = {
  id: "u-marketing",
  role: "member",
  memberships: [{ divisionId: "marketing" }],
};
const ADMIN = { id: "u-admin", role: "admin", memberships: [] };
const OWNER_ROLE = { id: "u-owner", role: "owner", memberships: [] };
const GUEST = { id: "u-guest", role: "external", memberships: [] };

const PRIVATE = { ownerId: AUTHOR.id, visibility: "private" as const };
const ORG_WIDE = { ownerId: AUTHOR.id, visibility: "organisation" as const };

const NO_SHARES: PageShareRow[] = [];

describe("the author", () => {
  it("can do everything with their own page", () => {
    expect(resolvePageAccess(AUTHOR, PRIVATE, NO_SHARES)).toEqual({
      canView: true,
      canEdit: true,
      canManage: true,
    });
  });
});

describe("a private page", () => {
  it("is invisible to everyone else", () => {
    expect(resolvePageAccess(OTHER, PRIVATE, NO_SHARES).canView).toBe(false);
  });

  it("stays invisible to a global admin", () => {
    // deliberate: "private" that leadership can read anyway is not private
    expect(resolvePageAccess(ADMIN, PRIVATE, NO_SHARES).canView).toBe(false);
  });

  it("stays invisible to the org owner", () => {
    expect(resolvePageAccess(OWNER_ROLE, PRIVATE, NO_SHARES).canView).toBe(false);
  });
});

describe("direct shares", () => {
  it("grant read to the named person only", () => {
    const shares = [{ userId: OTHER.id, divisionId: null, canEdit: false }];
    expect(resolvePageAccess(OTHER, PRIVATE, shares)).toEqual({
      canView: true,
      canEdit: false,
      canManage: false,
    });
    expect(resolvePageAccess(MARKETING, PRIVATE, shares).canView).toBe(false);
  });

  it("grant editing when canEdit is set", () => {
    const shares = [{ userId: OTHER.id, divisionId: null, canEdit: true }];
    expect(resolvePageAccess(OTHER, PRIVATE, shares).canEdit).toBe(true);
  });

  it("never grant managing — sharing and deleting stay with the author", () => {
    const shares = [{ userId: OTHER.id, divisionId: null, canEdit: true }];
    expect(resolvePageAccess(OTHER, PRIVATE, shares).canManage).toBe(false);
  });
});

describe("division shares", () => {
  it("reach every member of that division", () => {
    const shares = [{ userId: null, divisionId: "marketing", canEdit: false }];
    expect(resolvePageAccess(MARKETING, PRIVATE, shares).canView).toBe(true);
    expect(resolvePageAccess(OTHER, PRIVATE, shares).canView).toBe(false);
  });

  it("do not reach a different division", () => {
    const shares = [{ userId: null, divisionId: "production", canEdit: true }];
    expect(resolvePageAccess(MARKETING, PRIVATE, shares).canView).toBe(false);
  });

  it("take the most permissive of several matching grants", () => {
    // named read-only, but their division has edit — edit wins
    const shares = [
      { userId: MARKETING.id, divisionId: null, canEdit: false },
      { userId: null, divisionId: "marketing", canEdit: true },
    ];
    expect(resolvePageAccess(MARKETING, PRIVATE, shares).canEdit).toBe(true);
  });
});

describe("organisation-wide pages", () => {
  it("are readable by any internal user", () => {
    expect(resolvePageAccess(OTHER, ORG_WIDE, NO_SHARES).canView).toBe(true);
  });

  it("are still NOT writable without an explicit grant", () => {
    // a shared SOP must not be silently rewritten by anyone who opens it
    expect(resolvePageAccess(OTHER, ORG_WIDE, NO_SHARES).canEdit).toBe(false);
  });

  it("become writable for someone granted edit", () => {
    const shares = [{ userId: OTHER.id, divisionId: null, canEdit: true }];
    expect(resolvePageAccess(OTHER, ORG_WIDE, shares).canEdit).toBe(true);
  });
});

describe("external accounts", () => {
  it("are refused even when explicitly shared with", () => {
    const shares = [{ userId: GUEST.id, divisionId: null, canEdit: true }];
    expect(resolvePageAccess(GUEST, ORG_WIDE, shares)).toEqual({
      canView: false,
      canEdit: false,
      canManage: false,
    });
  });
});
