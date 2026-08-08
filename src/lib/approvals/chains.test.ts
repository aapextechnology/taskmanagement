import { describe, expect, it } from "vitest";
import { resolveChain } from "./chains";

const T = { a: 10_000_000, b: 100_000_000 };

describe("resolveChain — PRD Appendix B", () => {
  it("expense ≤ A stops at the division head (boundary inclusive)", () => {
    expect(resolveChain("expense", 5_000_000, T)).toEqual(["division_head"]);
    expect(resolveChain("expense", 10_000_000, T)).toEqual(["division_head"]);
  });

  it("A < expense ≤ B adds finance (boundaries exact)", () => {
    expect(resolveChain("expense", 10_000_001, T)).toEqual([
      "division_head",
      "finance",
    ]);
    expect(resolveChain("expense", 100_000_000, T)).toEqual([
      "division_head",
      "finance",
    ]);
  });

  it("expense > B goes all the way to the owner", () => {
    expect(resolveChain("expense", 100_000_001, T)).toEqual([
      "division_head",
      "finance",
      "owner",
    ]);
  });

  it("null amount is treated as zero", () => {
    expect(resolveChain("expense", null, T)).toEqual(["division_head"]);
  });

  it("artist offers: talent head → finance → owner", () => {
    expect(resolveChain("artist_offer", null, T)).toEqual([
      "talent_head",
      "finance",
      "owner",
    ]);
  });

  it("contracts: legal review → owner", () => {
    expect(resolveChain("contract", null, T)).toEqual(["legal", "owner"]);
  });

  it("sponsorship deals: sponsorship head → legal → owner", () => {
    expect(resolveChain("sponsorship_deal", null, T)).toEqual([
      "sponsorship_head",
      "legal",
      "owner",
    ]);
  });

  it("public content stops at the marketing head", () => {
    expect(resolveChain("public_content", null, T)).toEqual(["marketing_head"]);
  });

  it("custom thresholds re-route without code changes", () => {
    expect(resolveChain("expense", 2_000_000, { a: 1_000_000, b: 5_000_000 })).toEqual(
      ["division_head", "finance"],
    );
  });
});
