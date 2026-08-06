import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { divisions, profiles } from "./org";

// External collaborator model (T-070, PLAN §5). An invite scopes ONE guest
// profile to ONE event + ONE division. The magic-link token is stored only
// as a sha256 hash; scope/revocation/expiry are checked on EVERY request,
// so revoking cuts access immediately regardless of session lifetime.

export const externalInvites = pgTable(
  "external_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    divisionId: text("division_id")
      .notNull()
      .references(() => divisions.id),
    // which structured forms this guest is asked to submit
    requestedForms: jsonb("requested_forms").notNull().default([]),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    invitedBy: uuid("invited_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // one active invite per guest per event
    uniqueIndex("external_invites_profile_event_idx").on(t.profileId, t.eventId),
  ],
);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "accepted",
  "changes_requested",
]);

// Structured form submissions (T-073). Field templates are code-defined in
// src/lib/external/forms.ts (decision: no form_templates table for v1 —
// the four PLAN forms are fixed; a builder can come later).
export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  inviteId: uuid("invite_id")
    .notNull()
    .references(() => externalInvites.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  // quotation | technical_rider | logistics_manifest | crew_list
  type: text("type").notNull(),
  data: jsonb("data").notNull().default({}),
  status: submissionStatusEnum("status").notNull().default("draft"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
