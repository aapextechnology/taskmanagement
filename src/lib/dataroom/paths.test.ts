import { describe, expect, it } from "vitest";
import {
  filePath,
  isId,
  resolveInRoot,
  safeDownloadName,
  UnsafePathError,
  versionPath,
} from "./paths";

const EVENT = "00000000-0000-4000-8000-00000000e001";
const FILE = "11111111-1111-4111-8111-111111111111";

describe("isId", () => {
  it("accepts a v4 uuid and rejects anything else", () => {
    expect(isId(EVENT)).toBe(true);
    expect(isId("not-a-uuid")).toBe(false);
    expect(isId("")).toBe(false);
    expect(isId("../../etc/passwd")).toBe(false);
  });
});

describe("versionPath", () => {
  it("builds <event>/<file>/<version>", () => {
    expect(versionPath(EVENT, FILE, 3)).toBe(`${EVENT}/${FILE}/3`);
  });

  it("refuses ids that are not uuids, before any path join happens", () => {
    // this is the traversal guard: a crafted id never reaches path.join
    expect(() => versionPath("../../etc", FILE, 1)).toThrow(UnsafePathError);
    expect(() => versionPath(EVENT, "..", 1)).toThrow(UnsafePathError);
  });

  it("refuses a version number that is not a positive integer", () => {
    expect(() => versionPath(EVENT, FILE, 0)).toThrow(UnsafePathError);
    expect(() => versionPath(EVENT, FILE, -1)).toThrow(UnsafePathError);
    expect(() => versionPath(EVENT, FILE, 1.5)).toThrow(UnsafePathError);
  });

  it("never reuses a path across versions, so nothing is overwritten", () => {
    expect(versionPath(EVENT, FILE, 1)).not.toBe(versionPath(EVENT, FILE, 2));
  });
});

describe("filePath", () => {
  it("is the directory holding every version", () => {
    expect(filePath(EVENT, FILE)).toBe(`${EVENT}/${FILE}`);
    expect(versionPath(EVENT, FILE, 2).startsWith(filePath(EVENT, FILE))).toBe(true);
  });
});

describe("resolveInRoot", () => {
  it("resolves inside the root", () => {
    expect(resolveInRoot("/srv/dataroom", `${EVENT}/${FILE}/1`)).toBe(
      `/srv/dataroom/${EVENT}/${FILE}/1`,
    );
  });

  it("refuses a path that climbs out of the root", () => {
    expect(() => resolveInRoot("/srv/dataroom", "../secrets")).toThrow(
      UnsafePathError,
    );
    expect(() => resolveInRoot("/srv/dataroom", "/etc/passwd")).toThrow(
      UnsafePathError,
    );
  });

  it("does not mistake a sibling directory for the root", () => {
    // /srv/dataroom-old must not pass as inside /srv/dataroom
    expect(() => resolveInRoot("/srv/dataroom", "../dataroom-old/x")).toThrow(
      UnsafePathError,
    );
  });
});

describe("safeDownloadName", () => {
  it("keeps an ordinary name", () => {
    expect(safeDownloadName("Kontrak Vendor 2026.pdf")).toBe(
      "Kontrak Vendor 2026.pdf",
    );
  });

  it("strips quotes and newlines that would inject a header", () => {
    expect(safeDownloadName('evil".pdf\r\nX-Injected: 1')).toBe(
      "evil.pdf X-Injected: 1",
    );
  });

  it("flattens path separators", () => {
    expect(safeDownloadName("../../etc/passwd")).toBe("..-..-etc-passwd");
  });

  it("falls back rather than returning an empty filename", () => {
    expect(safeDownloadName("   ")).toBe("download");
  });
});
