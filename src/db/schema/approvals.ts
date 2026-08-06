import {
  bigint,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { divisions, profiles } from "./org";

// Approvals engine schema (T-040). A request resolves to an ordered chain of
// steps at creation time (PRD Appendix B); each step records its decision
// immutably — history is never rewritten.

export const approvalTypeEnum = pgEnum("approval_type", [
  "expense",
  "artist_offer",
  "contract",
  "sponsorship_deal",
  "public_content",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
]);

export const approvalStepStatusEnum = pgEnum("approval_step_status", [
  "waiting", // not this step's turn yet
  "pending", // current step, awaiting decision
  "approved",
  "rejected",
  "changes_requested",
]);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: approvalTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // integer IDR (no minor units); null for non-monetary requests
  amount: bigint("amount", { mode: "number" }),
  currency: text("currency").notNull().default("IDR"),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  eventId: uuid("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => profiles.id),
  status: approvalStatusEnum("status").notNull().default("pending"),
  currentStepIndex: integer("current_step_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const approvalSteps = pgTable("approval_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  approvalId: uuid("approval_id")
    .notNull()
    .references(() => approvals.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  // semantic approver key resolved against the org at decision time:
  // division_head | finance | owner | legal | sponsorship_head |
  // marketing_head | talent_head
  approverRole: text("approver_role").notNull(),
  status: approvalStepStatusEnum("status").notNull().default("waiting"),
  decidedBy: uuid("decided_by").references(() => profiles.id),
  comment: text("comment").notNull().default(""),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});
