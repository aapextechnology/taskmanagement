// Event identity colours (Owner 2026-08-12).
//
// Pure and shared, because the swatch has to look identical in the sidebar,
// the events grid and the picker — three copies of a palette drift, and the
// one that drifts is the one nobody looks at.
//
// Every event gets a colour whether or not anyone chooses one: a palette
// that must be opted into stays empty, and a sidebar of grey dots is the
// thing we were trying to fix. The default is derived from the event's id,
// so it is stable for the life of the event and spread across the palette.

export const EVENT_COLORS = [
  { id: "rose", label: "Rose", className: "bg-[oklch(0.72_0.16_15)]" },
  { id: "amber", label: "Amber", className: "bg-[oklch(0.78_0.15_70)]" },
  { id: "lime", label: "Lime", className: "bg-[oklch(0.80_0.16_130)]" },
  { id: "emerald", label: "Emerald", className: "bg-[oklch(0.74_0.13_165)]" },
  { id: "teal", label: "Teal", className: "bg-[oklch(0.75_0.11_195)]" },
  { id: "sky", label: "Sky", className: "bg-[oklch(0.74_0.13_235)]" },
  { id: "indigo", label: "Indigo", className: "bg-[oklch(0.62_0.17_275)]" },
  { id: "violet", label: "Violet", className: "bg-[oklch(0.68_0.17_305)]" },
  { id: "pink", label: "Pink", className: "bg-[oklch(0.75_0.15_345)]" },
  { id: "slate", label: "Slate", className: "bg-[oklch(0.62_0.02_260)]" },
] as const;

export type EventColorId = (typeof EVENT_COLORS)[number]["id"];

/** Stable, evenly-spread default for an event that has never been given one. */
export function defaultColorFor(eventId: string): EventColorId {
  let hash = 0;
  for (let i = 0; i < eventId.length; i += 1) {
    hash = (hash * 31 + eventId.charCodeAt(i)) >>> 0;
  }
  return EVENT_COLORS[hash % EVENT_COLORS.length].id;
}

/** The swatch class for an event, falling back to its derived colour. */
export function eventColorClass(
  eventId: string,
  color: string | null | undefined,
): string {
  const chosen = EVENT_COLORS.find((c) => c.id === color);
  const resolved = chosen ?? EVENT_COLORS.find((c) => c.id === defaultColorFor(eventId));
  return resolved?.className ?? EVENT_COLORS[EVENT_COLORS.length - 1].className;
}

export function isEventColor(value: string): value is EventColorId {
  return EVENT_COLORS.some((c) => c.id === value);
}
