import { describe, expect, it } from "vitest";
import {
  MAX_WATERMARK_BYTES,
  escapeXml,
  watermarkDecision,
  watermarkText,
} from "./watermark";

const SMALL = 1024;
const AT = new Date("2026-08-11T03:30:00Z"); // 10:30 WIB

describe("watermarkDecision", () => {
  it("accepts PDFs and the image types we can composite", () => {
    expect(watermarkDecision("application/pdf", SMALL)).toEqual({ ok: true, kind: "pdf" });
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(watermarkDecision(type, SMALL)).toEqual({ ok: true, kind: "image" });
    }
  });

  it("ignores charset parameters and casing on the mime type", () => {
    expect(watermarkDecision("APPLICATION/PDF; charset=binary", SMALL).ok).toBe(true);
  });

  it("refuses Office files with the way out, rather than failing later", () => {
    const verdict = watermarkDecision(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      SMALL,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/export word or excel to pdf/i);
  });

  it("refuses anything too large to hold in memory, and says how large", () => {
    const verdict = watermarkDecision("application/pdf", MAX_WATERMARK_BYTES + 1);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain("25 MB");
  });

  it("allows a file exactly at the limit", () => {
    expect(watermarkDecision("application/pdf", MAX_WATERMARK_BYTES).ok).toBe(true);
  });
});

describe("watermarkText", () => {
  it("names the viewer, the organisation and the moment in WIB", () => {
    const text = watermarkText({
      viewer: "vendor@company.test",
      orgName: "Raw Vision",
      at: AT,
    });
    expect(text).toContain("vendor@company.test");
    expect(text).toContain("Raw Vision");
    expect(text).toContain("10:30"); // 03:30Z is 10:30 in Jakarta
    expect(text).toContain("WIB");
  });

  it("still marks the copy when the link asked for no email", () => {
    // an unattributed copy is still worth marking: it proves the leak came
    // through a share link rather than from inside
    const text = watermarkText({ viewer: null, orgName: "Raw Vision", at: AT });
    expect(text).toContain("Shared link");
  });

  it("treats a blank viewer as no viewer", () => {
    expect(watermarkText({ viewer: "   ", orgName: "X", at: AT })).toContain(
      "Shared link",
    );
  });
});

describe("escapeXml", () => {
  it("neutralises characters that would break or inject into the overlay", () => {
    expect(escapeXml('a<b>&"c\'')).toBe("a&lt;b&gt;&amp;&quot;c&apos;");
  });

  it("leaves an ordinary email untouched", () => {
    expect(escapeXml("vendor@company.test")).toBe("vendor@company.test");
  });
});
