// Chain resolution (T-040) — pure, per PRD Appendix B. Thresholds come from
// app_settings (Owner decision 2026-08-06: currency IDR; figures are proposed
// defaults until confirmed).

export type ApprovalType =
  | "expense"
  | "artist_offer"
  | "contract"
  | "sponsorship_deal"
  | "public_content";

export type ApproverRole =
  | "division_head"
  | "finance"
  | "owner"
  | "legal"
  | "sponsorship_head"
  | "marketing_head"
  | "talent_head";

export interface Thresholds {
  a: number; // expense ≤ a           → division head only
  b: number; // a < expense ≤ b      → + finance; > b → + owner
}

export const APPROVER_LABELS: Record<ApproverRole, string> = {
  division_head: "Division Head",
  finance: "Finance",
  owner: "Owner",
  legal: "Legal",
  sponsorship_head: "Sponsorship Head",
  marketing_head: "Marketing Head",
  talent_head: "Talent Head",
};

export function resolveChain(
  type: ApprovalType,
  amount: number | null,
  thresholds: Thresholds,
): ApproverRole[] {
  switch (type) {
    case "expense": {
      const value = amount ?? 0;
      if (value <= thresholds.a) return ["division_head"];
      if (value <= thresholds.b) return ["division_head", "finance"];
      return ["division_head", "finance", "owner"];
    }
    case "artist_offer":
      return ["talent_head", "finance", "owner"];
    case "contract":
      return ["legal", "owner"];
    case "sponsorship_deal":
      return ["sponsorship_head", "legal", "owner"];
    case "public_content":
      return ["marketing_head"];
  }
}
