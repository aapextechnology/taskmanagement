import { describe, expect, it } from "vitest";
import { bucketForDue, nextRecurrenceDate } from "./dates";

// Wed 2026-08-05 17:00 UTC = Thu 2026-08-06 00:00 WIB... use a clear anchor:
// now = 2026-08-06 03:00 UTC = 2026-08-06 10:00 WIB (Thursday)
const now = new Date("2026-08-06T03:00:00Z");

describe("bucketForDue (WIB)", () => {
  it("null due → none", () => {
    expect(bucketForDue(null, now)).toBe("none");
  });

  it("past instant → overdue", () => {
    expect(bucketForDue(new Date("2026-08-06T02:59:00Z"), now)).toBe("overdue");
  });

  it("later the same WIB day → today", () => {
    // 20:00 WIB same day = 13:00 UTC
    expect(bucketForDue(new Date("2026-08-06T13:00:00Z"), now)).toBe("today");
    // 23:59 WIB = 16:59 UTC
    expect(bucketForDue(new Date("2026-08-06T16:59:00Z"), now)).toBe("today");
  });

  it("tomorrow through Sunday → this_week", () => {
    // Friday 10:00 WIB
    expect(bucketForDue(new Date("2026-08-07T03:00:00Z"), now)).toBe("this_week");
    // Sunday 23:00 WIB = Sunday 16:00 UTC
    expect(bucketForDue(new Date("2026-08-09T16:00:00Z"), now)).toBe("this_week");
  });

  it("next Monday onward → later", () => {
    // Monday 00:30 WIB = Sunday 17:30 UTC
    expect(bucketForDue(new Date("2026-08-09T17:30:00Z"), now)).toBe("later");
  });
});

describe("nextRecurrenceDate", () => {
  const base = new Date("2026-08-06T10:00:00Z");

  it("daily/weekly add exact intervals", () => {
    expect(nextRecurrenceDate(base, "daily")?.toISOString()).toBe(
      "2026-08-07T10:00:00.000Z",
    );
    expect(nextRecurrenceDate(base, "weekly")?.toISOString()).toBe(
      "2026-08-13T10:00:00.000Z",
    );
  });

  it("monthly advances the calendar month (across year boundary too)", () => {
    expect(nextRecurrenceDate(base, "monthly")?.toISOString()).toBe(
      "2026-09-06T10:00:00.000Z",
    );
    expect(
      nextRecurrenceDate(new Date("2026-12-15T00:00:00Z"), "monthly")?.toISOString(),
    ).toBe("2027-01-15T00:00:00.000Z");
  });

  it("none → null", () => {
    expect(nextRecurrenceDate(base, "none")).toBeNull();
  });
});
