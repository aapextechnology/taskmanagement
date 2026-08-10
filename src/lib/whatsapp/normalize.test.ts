import { describe, expect, it } from "vitest";
import { normalizeMsisdn, toWhatsAppJid } from "./normalize";

describe("normalizeMsisdn", () => {
  it("converts the Indonesian local form 08xx to 628xx", () => {
    expect(normalizeMsisdn("081234567890")).toBe("6281234567890");
    expect(normalizeMsisdn("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeMsisdn("0812 3456 7890")).toBe("6281234567890");
  });

  it("keeps an already-international number, with or without +", () => {
    expect(normalizeMsisdn("+6281234567890")).toBe("6281234567890");
    expect(normalizeMsisdn("6281234567890")).toBe("6281234567890");
    expect(normalizeMsisdn("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("strips the 00 international prefix", () => {
    expect(normalizeMsisdn("006281234567890")).toBe("6281234567890");
  });

  it("prepends the country code to a bare local number", () => {
    expect(normalizeMsisdn("81234567890")).toBe("6281234567890");
  });

  it("honours a different country code", () => {
    expect(normalizeMsisdn("07700900123", "44")).toBe("447700900123");
    expect(normalizeMsisdn("+14155550123", "44")).toBe("14155550123");
  });

  it("rejects junk and impossible lengths", () => {
    expect(normalizeMsisdn("")).toBeNull();
    expect(normalizeMsisdn("   ")).toBeNull();
    expect(normalizeMsisdn("not a phone")).toBeNull();
    expect(normalizeMsisdn("12")).toBeNull();
    expect(normalizeMsisdn("+1234567890123456789")).toBeNull();
  });
});

describe("toWhatsAppJid", () => {
  it("builds the personal-chat JID", () => {
    expect(toWhatsAppJid("0812-3456-7890")).toBe("6281234567890@s.whatsapp.net");
  });

  it("returns null rather than a malformed JID", () => {
    expect(toWhatsAppJid("nope")).toBeNull();
  });
});
