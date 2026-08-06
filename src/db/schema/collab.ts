import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { divisions, profiles } from "./org";
import { tasks } from "./tasks";

// Collaboration around tasks (T-034/T-036): comments, attachments, handoffs.

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  body: text("body").notNull(),
  // uuid[] of mentioned profiles, for audit + notification
  mentions: jsonb("mentions").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  uploaderId: uuid("uploader_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  fileName: text("file_name").notNull(),
  // relative to UPLOADS_DIR, served via /api/files
  path: text("path").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const handoffStatusEnum = pgEnum("handoff_status", [
  "pending",
  "accepted",
  "declined",
]);

// Cross-division handoff (T-036): "fromDivision asks toDivision for work".
// On accept a task is created in toDivision and the origin task (if any)
// becomes blocked by it.
export const handoffs = pgTable("handoffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  fromDivisionId: text("from_division_id")
    .notNull()
    .references(() => divisions.id),
  toDivisionId: text("to_division_id")
    .notNull()
    .references(() => divisions.id),
  originTaskId: uuid("origin_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  status: handoffStatusEnum("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  decidedBy: uuid("decided_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdTaskId: uuid("created_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});
