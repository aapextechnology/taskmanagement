export const TYPE_LABELS: Record<string, string> = {
  expense: "Expense",
  artist_offer: "Artist offer",
  contract: "Contract",
  sponsorship_deal: "Sponsorship deal",
  public_content: "Public content",
};

export const APPROVAL_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "text-status-in-progress" },
  approved: { label: "Approved", className: "text-status-done" },
  rejected: { label: "Rejected", className: "text-status-blocked" },
  changes_requested: {
    label: "Changes requested",
    className: "text-status-in-review",
  },
};

export function formatIDR(amount: number | null): string {
  if (amount === null) return "—";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
