import { describe, expect, it } from "vitest";
import { normalizeMsisdn } from "@/lib/whatsapp/normalize";

// The admin contact field accepts what Indonesian staff actually type. These
// guard the exact shapes an admin will paste into the Users table.
describe("phone numbers an admin will type", () => {
  it("accepts the local 08 form", () => {
    expect(normalizeMsisdn("0812 3456 7890")).toBe("6281234567890");
  });

  it("accepts +62 and 62 unchanged in meaning", () => {
    expect(normalizeMsisdn("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizeMsisdn("6281234567890")).toBe("6281234567890");
  });

  it("does not double the country code on the 0062 form", () => {
    expect(normalizeMsisdn("00628123456789")).toBe("628123456789");
  });

  it("rejects text and obviously wrong lengths, so it cannot be saved", () => {
    expect(normalizeMsisdn("not a phone")).toBeNull();
    expect(normalizeMsisdn("123")).toBeNull();
    expect(normalizeMsisdn("")).toBeNull();
  });
});
