import { describe, expect, it } from "vitest";
import { countdownTo } from "./countdown";

const base = new Date("2026-08-06T00:00:00Z");

describe("countdownTo", () => {
  it("splits a future distance into days/hours/minutes/seconds", () => {
    const target = new Date("2026-08-08T03:04:05Z");
    expect(countdownTo(target, base)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      reached: false,
    });
  });

  it("returns zeros and reached=true once show day has passed", () => {
    const target = new Date("2026-08-05T23:59:59Z");
    expect(countdownTo(target, base)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      reached: true,
    });
  });

  it("treats the exact moment as reached", () => {
    expect(countdownTo(base, base).reached).toBe(true);
  });

  it("handles sub-minute distances", () => {
    const target = new Date("2026-08-06T00:00:59Z");
    expect(countdownTo(target, base)).toMatchObject({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 59,
    });
  });
});
