// Drizzle schema root (protected path — changes require a reviewed task).
// Domain tables land epic by epic: org (T-010), events (T-020), tasks (T-030)…
// `app_settings` ships first so the migration pipeline is proven end-to-end and
// later epics (approval thresholds, health rules) have a place for org config.

export * from "./activity";
export * from "./app-settings";
export * from "./org";
