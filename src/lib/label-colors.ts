// Curated label palette (Owner request 2026-08-06): labels carry a color key;
// this is the single mapping to actual values. Alpha backgrounds keep chips
// readable in both themes.

export const LABEL_COLORS = {
  slate: { label: "Slate", dot: "#94a3b8" },
  blue: { label: "Blue", dot: "#60a5fa" },
  green: { label: "Green", dot: "#4ade80" },
  amber: { label: "Amber", dot: "#fbbf24" },
  orange: { label: "Orange", dot: "#fb923c" },
  red: { label: "Red", dot: "#f87171" },
  violet: { label: "Violet", dot: "#a78bfa" },
  pink: { label: "Pink", dot: "#f472b6" },
} as const;

export type LabelColor = keyof typeof LABEL_COLORS;

export function labelColorKey(value: string): LabelColor {
  return value in LABEL_COLORS ? (value as LabelColor) : "slate";
}
