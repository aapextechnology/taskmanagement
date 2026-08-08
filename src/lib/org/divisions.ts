// The 11 default divisions (PLAN §3) — canonical slugs used across the system.
// Seeded idempotently; slugs are stable identifiers, never renamed.

export const DIVISIONS = [
  { id: "talent-booking", name: "Talent & Booking" },
  { id: "production", name: "Production" },
  { id: "operations-logistics", name: "Operations & Logistics" },
  { id: "security-safety", name: "Security & Safety" },
  { id: "hospitality-artist-liaison", name: "Hospitality & Artist Liaison" },
  { id: "marketing-communications", name: "Marketing & Communications" },
  { id: "ticketing-sales", name: "Ticketing & Sales" },
  { id: "sponsorship-partnership", name: "Sponsorship & Partnership" },
  { id: "finance", name: "Finance" },
  { id: "legal-licensing", name: "Legal & Licensing" },
  { id: "hr-volunteers", name: "HR & Volunteers" },
] as const;

export type DivisionId = (typeof DIVISIONS)[number]["id"];
