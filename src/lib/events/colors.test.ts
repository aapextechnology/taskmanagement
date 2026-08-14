import { describe, expect, it } from "vitest";
import {
  EVENT_COLORS,
  defaultColorFor,
  eventColorClass,
  isEventColor,
} from "./colors";

const A = "00000000-0000-4000-8000-00000000e001";
const B = "8c92c298-1d9a-41e0-8e1f-80440977441d";

describe("defaultColorFor", () => {
  it("is stable for the same event", () => {
    expect(defaultColorFor(A)).toBe(defaultColorFor(A));
  });

  it("spreads across the palette rather than favouring one end", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `event-${i}`);
    const used = new Set(ids.map(defaultColorFor));
    expect(used.size).toBeGreaterThan(EVENT_COLORS.length / 2);
  });

  it("gives different events different colours", () => {
    expect(defaultColorFor(A)).not.toBe(defaultColorFor(B));
  });
});

describe("eventColorClass", () => {
  it("uses the chosen colour when there is one", () => {
    const rose = EVENT_COLORS.find((c) => c.id === "rose")!;
    expect(eventColorClass(A, "rose")).toBe(rose.className);
  });

  it("falls back to the derived colour, never to nothing", () => {
    // an event with no colour must still get a swatch — a grey sidebar is
    // what this feature exists to fix
    expect(eventColorClass(A, null)).toBeTruthy();
    expect(eventColorClass(A, null)).toBe(eventColorClass(A, undefined));
  });

  it("ignores a colour that is not in the palette", () => {
    expect(eventColorClass(A, "chartreuse")).toBe(eventColorClass(A, null));
  });
});

describe("isEventColor", () => {
  it("guards what may be stored", () => {
    expect(isEventColor("teal")).toBe(true);
    expect(isEventColor("chartreuse")).toBe(false);
  });
});
