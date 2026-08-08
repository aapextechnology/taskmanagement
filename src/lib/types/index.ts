// Shared domain types for the app. Database row types are inferred from
// the Drizzle schema (src/db/schema) once it lands in T-003/T-010; this module
// holds the cross-cutting enums and contracts the UI and services share.

export const ROLES = ["owner", "admin", "head", "staff", "external"] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_PHASES = [
  "planning",
  "pre_production",
  "promotion",
  "show_week",
  "show_day",
  "settlement",
] as const;
export type EventPhase = (typeof EVENT_PHASES)[number];

export const EVENT_HEALTH = ["on_track", "at_risk", "critical"] as const;
export type EventHealth = (typeof EVENT_HEALTH)[number];

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
