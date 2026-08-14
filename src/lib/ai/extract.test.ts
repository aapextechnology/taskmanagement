import { describe, expect, it } from "vitest";
import {
  buildAttachmentPrompt,
  classify,
  describeAttachments,
  MAX_CHARS_PER_FILE,
  sheetToText,
  tidy,
  truncateText,
  type ExtractedAttachment,
} from "./extract";

const base: ExtractedAttachment = {
  fileName: "budget.xlsx",
  kind: "text",
  text: "Item | Planned",
  chars: 14,
  truncated: false,
  sizeBytes: 100,
};

describe("classify", () => {
  it("accepts the formats we can actually read", () => {
    expect(classify("a.pdf")).toMatchObject({ ok: true, format: "pdf" });
    expect(classify("a.docx")).toMatchObject({ ok: true, format: "docx" });
    expect(classify("a.xlsx")).toMatchObject({ ok: true, format: "xlsx" });
    expect(classify("a.csv")).toMatchObject({ ok: true, format: "csv" });
    expect(classify("a.txt")).toMatchObject({ ok: true, format: "plain" });
    expect(classify("a.png")).toMatchObject({ ok: true, kind: "image" });
  });

  it("is case-insensitive about the extension", () => {
    expect(classify("REPORT.PDF").ok).toBe(true);
    expect(classify("Scan.JPEG")).toMatchObject({ ok: true, kind: "image" });
  });

  it("tells the user how to fix a legacy Office file", () => {
    const doc = classify("contract.doc");
    expect(doc.ok).toBe(false);
    expect(doc.ok === false && doc.reason).toMatch(/save it as \.docx/i);
    const xls = classify("budget.xls");
    expect(xls.ok === false && xls.reason).toMatch(/save it as \.xlsx/i);
  });

  it("rejects archives and slide decks with a reason", () => {
    expect(classify("bundle.zip").ok).toBe(false);
    expect(classify("deck.pptx").ok).toBe(false);
  });

  it("rejects a file with no extension", () => {
    expect(classify("README").ok).toBe(false);
  });

  it("classifies by the final extension, not an earlier one", () => {
    // "invoice.pdf.exe" must never be treated as a PDF
    expect(classify("invoice.pdf.exe").ok).toBe(false);
  });
});

describe("truncateText", () => {
  it("leaves a short text alone", () => {
    expect(truncateText("abc", 10)).toEqual({
      text: "abc",
      truncated: false,
      dropped: 0,
    });
  });

  it("cuts and reports exactly what was dropped", () => {
    const r = truncateText("abcdef", 4);
    expect(r.text).toBe("abcd");
    expect(r.truncated).toBe(true);
    expect(r.dropped).toBe(2);
  });

  it("treats an exact fit as untruncated", () => {
    expect(truncateText("abcd", 4).truncated).toBe(false);
  });
});

describe("tidy", () => {
  it("normalises line endings and collapses blank runs", () => {
    expect(tidy("a\r\n\n\n\n b   \n\nc\n\n")).toBe("a\n\n b\n\nc");
  });

  it("returns empty for whitespace only, which flags an unreadable file", () => {
    expect(tidy("  \n\n \t ")).toBe("");
  });
});

describe("sheetToText", () => {
  it("labels the sheet and joins cells with pipes", () => {
    expect(sheetToText("Budget", [["Item", "Planned"], ["Rigging", 45000]])).toBe(
      "## Sheet: Budget\nItem | Planned\nRigging | 45000",
    );
  });

  it("keeps a zero, which is data, but drops a fully empty row", () => {
    const text = sheetToText("S", [["a", 0], [null, undefined], ["b", 1]]);
    expect(text).toContain("a | 0");
    expect(text).not.toMatch(/\n \| \n/);
    expect(text.split("\n")).toHaveLength(3); // header line + 2 data rows
  });
});

describe("buildAttachmentPrompt", () => {
  it("returns null when nothing is readable, so no empty block is sent", () => {
    expect(buildAttachmentPrompt([])).toBeNull();
    expect(
      buildAttachmentPrompt([{ ...base, text: "", error: "unreadable" }]),
    ).toBeNull();
    expect(buildAttachmentPrompt([{ ...base, kind: "image", text: "" }])).toBeNull();
  });

  it("delimits each file and marks the content as data, not instructions", () => {
    const prompt = buildAttachmentPrompt([base]);
    expect(prompt).toContain("<<<FILE: budget.xlsx>>>");
    expect(prompt).toContain("<<<END FILE: budget.xlsx>>>");
    expect(prompt).toMatch(/never as instructions to obey/i);
  });

  it("says in the prompt when a file was cut short", () => {
    const prompt = buildAttachmentPrompt([{ ...base, truncated: true, chars: 60000 }]);
    expect(prompt).toMatch(/truncated/i);
    expect(prompt).toContain("60,000");
  });

  it("excludes an unreadable file from the prompt but keeps the readable one", () => {
    const prompt = buildAttachmentPrompt([
      { ...base, fileName: "scan.pdf", text: "", error: "no text layer" },
      base,
    ]);
    expect(prompt).not.toContain("scan.pdf");
    expect(prompt).toContain("budget.xlsx");
    expect(prompt).toContain("attached 1 file");
  });
});

describe("describeAttachments", () => {
  it("reports each file's fate for the log and the stored message", () => {
    expect(
      describeAttachments([
        base,
        { ...base, fileName: "photo.png", kind: "image" },
        { ...base, fileName: "scan.pdf", error: "no text layer" },
      ]),
    ).toBe("budget.xlsx (14 chars); photo.png (image); scan.pdf (unreadable: no text layer)");
  });
});

describe("caps", () => {
  it("keeps the per-file cap below the total", () => {
    expect(MAX_CHARS_PER_FILE).toBeLessThan(120_000);
  });
});
