import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://user:pass@localhost:5438/db",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("parseEnv", () => {
  it("accepts a minimal valid environment and applies defaults", () => {
    const env = parseEnv(valid);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.NODE_ENV).toBe("development");
  });

  it("fails fast when DATABASE_URL is missing, naming the variable", () => {
    expect(() => parseEnv({ AUTH_SECRET: valid.AUTH_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: "mysql://root@localhost/db" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("lists every problem at once", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*AUTH_SECRET/);
  });
});
