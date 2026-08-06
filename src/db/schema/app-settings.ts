import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Org-wide key/value settings (currency, approval thresholds A/B, health rule
// tuning). Read through a typed accessor in the service layer — not directly.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
