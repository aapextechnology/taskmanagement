// Is the Tessera connection alive or dead? (Owner 2026-08-13.)
//
// Pure verdict over the stored status — no clock, no fetch. The hourly sync
// and every admin "Test connection" already write lastOkAt/lastError, so the
// freshest evidence is at most an hour old; rendering a page must not spend
// a call against their unofficial API just to color a dot.

export interface ApiHealthInput {
  configured: boolean;
  /** ~5-day token lifetime countdown; null when no token */
  daysLeft: number | null;
  lastOkAt: string | null;
  lastError: string | null;
}

export type ApiHealthState = "off" | "live" | "expiring" | "expired" | "error";

export interface ApiHealth {
  state: ApiHealthState;
  label: string;
  detail: string | null;
}

/** Does this stored error mean the token itself is dead (vs. a flaky call)? */
function isAuthError(message: string): boolean {
  return /401|unauthoriz|token expired|invalid token/i.test(message);
}

export function apiHealth(s: ApiHealthInput): ApiHealth {
  if (!s.configured) {
    return { state: "off", label: "Not connected", detail: null };
  }
  // the countdown beats the last call's outcome: a token past its ~5-day
  // lifetime is dead even if the final sync before midnight succeeded
  if (s.daysLeft !== null && s.daysLeft <= 0) {
    return {
      state: "expired",
      label: "Token expired",
      detail: "Paste a fresh token in Admin → Tessera ticketing.",
    };
  }
  if (s.lastError) {
    if (isAuthError(s.lastError)) {
      return {
        state: "expired",
        label: "Token rejected",
        detail: "Tessera answered 401 — paste a fresh token in Admin → Tessera ticketing.",
      };
    }
    return { state: "error", label: "API error", detail: s.lastError };
  }
  if (s.lastOkAt) {
    if (s.daysLeft !== null && s.daysLeft <= 1) {
      return {
        state: "expiring",
        label: "API live — token expiring",
        detail: `Token dies in about ${s.daysLeft <= 0 ? 0 : s.daysLeft} day(s); refresh it soon.`,
      };
    }
    return {
      state: "live",
      label: "API live",
      detail: s.daysLeft !== null ? `Token has ~${s.daysLeft} day(s) left.` : null,
    };
  }
  // token pasted, nothing has spoken to Tessera yet
  return {
    state: "error",
    label: "Not verified yet",
    detail: "Run Test connection or Sync now in Admin → Tessera ticketing.",
  };
}
