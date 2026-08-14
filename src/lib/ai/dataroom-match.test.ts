import { describe, expect, it } from "vitest";
import { matchRequestedFiles } from "./dataroom-match";

const files = [
  { fileId: "1", name: "Recovered document.pdf" },
  { fileId: "2", name: "Vendor contract.pdf" },
  { fileId: "3", name: "list.pdf" },
  { fileId: "4", name: "Settlement final.pdf" },
];

describe("matchRequestedFiles", () => {
  it("matches a file named in the question, extension optional", () => {
    expect(
      matchRequestedFiles("tolong ringkas vendor contract.pdf", files).map((f) => f.fileId),
    ).toEqual(["2"]);
    expect(
      matchRequestedFiles("ringkas Vendor Contract dong", files).map((f) => f.fileId),
    ).toEqual(["2"]);
  });

  it("never matches in the wrong direction", () => {
    // "list" appears in the question, but the QUESTION does not contain the
    // file's name — matching here would read a file nobody asked about and
    // write a phantom row into the access audit
    expect(matchRequestedFiles("list all my files please", files)).toEqual([]);
  });

  it("caps how many files one question can pull in", () => {
    const q = "bandingkan vendor contract.pdf dengan settlement final.pdf dan recovered document.pdf";
    expect(matchRequestedFiles(q, files)).toHaveLength(2);
  });

  it("prefers the longer, more specific name", () => {
    const both = [
      { fileId: "a", name: "final.pdf" },
      { fileId: "b", name: "Settlement final.pdf" },
    ];
    expect(matchRequestedFiles("buka settlement final.pdf", both)[0].fileId).toBe("b");
  });

  it("returns nothing for a trivial question", () => {
    expect(matchRequestedFiles("hi", files)).toEqual([]);
  });
});
