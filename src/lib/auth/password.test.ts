import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password", () => {
    const stored = hashPassword("backstage123");
    expect(verifyPassword("backstage123", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("backstage123");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("produces unique salts per hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored values without throwing", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
