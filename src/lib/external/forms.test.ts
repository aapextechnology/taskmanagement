import { describe, expect, it } from "vitest";
import { FORM_DEFINITIONS, FORM_TYPES, validateSubmission } from "./forms";

describe("structured forms", () => {
  it("defines all four PLAN §5 form types", () => {
    expect(FORM_TYPES).toEqual([
      "quotation",
      "technical_rider",
      "logistics_manifest",
      "crew_list",
    ]);
    for (const type of FORM_TYPES) {
      expect(FORM_DEFINITIONS[type].fields.length).toBeGreaterThan(2);
    }
  });

  it("flags every missing required field", () => {
    const problems = validateSubmission("quotation", {});
    expect(problems.length).toBeGreaterThanOrEqual(4);
    expect(problems.join(" ")).toMatch(/Vendor/);
  });

  it("accepts a complete quotation", () => {
    expect(
      validateSubmission("quotation", {
        vendor_name: "Sound Supply Co.",
        scope: "PA system x1",
        amount_idr: "85000000",
        valid_until: "2026-09-01",
      }),
    ).toEqual([]);
  });

  it("rejects non-numeric numbers", () => {
    expect(
      validateSubmission("crew_list", {
        company: "RigPro",
        people: "A — rigger",
        headcount: "twelve",
      }),
    ).toContain("Total headcount must be a number.");
  });
});
