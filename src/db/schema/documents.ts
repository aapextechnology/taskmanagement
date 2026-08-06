import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { events } from "./events";
import { divisions, profiles } from "./org";

// Document library (EPIC-008 T-082): contracts, permits, riders, stage plots —
// one file per row, scoped to one event + one division. Access is gated by
// document.view/document.manage (src/lib/permissions) — division head/staff
// or org-wide viewers only, externals never.

export const documentCategoryEnum = pgEnum("document_category", [
  "contract",
  "permit",
  "rider",
  "stage_plot",
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id, { onDelete: "restrict" }),
  category: documentCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  // stored relative to UPLOADS_DIR, e.g. "documents/<uuid>.pdf" — served
  // auth+division-gated via /api/files
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  sizeBytes: integer("size_bytes"),
  uploadedBy: uuid("uploaded_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
