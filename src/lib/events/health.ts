// Event health rule (T-023) — deterministic, per PRD Appendix B.
// Pure function: signals in, verdict out. Signal *gathering* lives in
// recompute.ts (tasks wire in with EPIC-003, budget with EPIC-005).

export type EventHealthStatus = "on_track" | "at_risk" | "critical";

export interface HealthSignals {
  overdueTasks: number;
  /** a blocked task sits on the critical path to show day */
  blockedOnCriticalPath: boolean;
  /** integer minor units; 0/undefined budget disables budget signals */
  budgetTotal?: number;
  budgetCommitted?: number;
  budgetActual?: number;
}

export interface HealthConfig {
  /** overdue count at/above which the event is CRITICAL */
  overdueCritical: number;
  /** committed-vs-total ratio above which the event is AT RISK */
  committedRatioAtRisk: number;
}

export const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  overdueCritical: 5,
  committedRatioAtRisk: 0.9,
};

export function computeHealth(
  signals: HealthSignals,
  config: HealthConfig = DEFAULT_HEALTH_CONFIG,
): EventHealthStatus {
  const total = signals.budgetTotal ?? 0;
  const committed = signals.budgetCommitted ?? 0;
  const actual = signals.budgetActual ?? 0;

  if (
    signals.overdueTasks >= config.overdueCritical ||
    signals.blockedOnCriticalPath ||
    (total > 0 && actual > total)
  ) {
    return "critical";
  }

  if (
    signals.overdueTasks > 0 ||
    (total > 0 && committed > total * config.committedRatioAtRisk)
  ) {
    return "at_risk";
  }

  return "on_track";
}
