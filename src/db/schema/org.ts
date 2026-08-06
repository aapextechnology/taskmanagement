import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Org structure (T-010). Global role lives on the profile; head/staff are
// DIVISION-scoped via division_members (a user can head one division and be
// plain staff in another). "member" = internal user whose authority comes
// entirely from division memberships. Multi-brand note (Owner 2026-08-06):
// keep only email globally unique — an `organizations` scope can be added
// later without breaking these keys.

export const globalRoleEnum = pgEnum("global_role", [
  "owner",
  "admin",
  "member",
  "external",
]);

export const divisionRoleEnum = pgEnum("division_role", ["head", "staff"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // null for external guests (magic-link only, EPIC-007)
  passwordHash: text("password_hash"),
  role: globalRoleEnum("role").notNull().default("member"),
  // E.164, used by the WhatsApp channel (T-064); optional
  phone: text("phone"),
  // channel preferences (T-062/T-064): email defaults on, WhatsApp opt-in
  emailNotifications: boolean("email_notifications").notNull().default(true),
  whatsappNotifications: boolean("whatsapp_notifications")
    .notNull()
    .default(false),
  // digest opt-ins (T-100): daily personal digest for anyone, weekly
  // executive digest only meaningful for owner/admin (dashboard.view)
  dailyDigest: boolean("daily_digest").notNull().default(false),
  weeklyDigest: boolean("weekly_digest").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const divisions = pgTable("divisions", {
  // stable slug pk ("production", "legal-licensing") — referenced everywhere
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const divisionMembers = pgTable(
  "division_members",
  {
    divisionId: text("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: divisionRoleEnum("role").notNull().default("staff"),
  },
  (table) => [primaryKey({ columns: [table.divisionId, table.userId] })],
);
