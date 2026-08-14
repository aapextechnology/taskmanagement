import {
  boolean,
  index,
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

// Event pages (Owner request 2026-08-07): a per-event mini-wiki. Content is
// the editor's JSON document (Tiptap), never HTML — rendering is done by the
// editor component, so stored content can't inject markup.
export const eventPages = pgTable(
  "event_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    content: jsonb("content"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("event_pages_event_idx").on(t.eventId)],
);

// ---------------------------------------------------------------------------
// Standalone pages (EPIC-016 T-160, Owner 2026-08-10): a workspace wiki that
// belongs to NO event — SOPs, meeting notes, and the summaries the assistant
// writes from an uploaded file.
//
// Deliberately a separate table from event_pages rather than a nullable
// event_id on that one. The two have opposite access models: an event page is
// readable by anyone who can see the event, a standalone page starts PRIVATE
// to its author. Sharing one table would mean a single query that forgot to
// filter on event_id could leak a private page into an event's wiki list.

export const pageVisibilityEnum = pgEnum("page_visibility", [
  "private", // author only, plus anyone in page_shares
  "organisation", // every internal user can read
]);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("Untitled"),
    // Tiptap JSON, same as event pages — never HTML, so stored content
    // cannot inject markup
    content: jsonb("content"),
    // deleting the author deletes their private pages: nobody else could
    // read them anyway, so leaving them orphaned would only hide data
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    visibility: pageVisibilityEnum("visibility").notNull().default("private"),
    // set when the assistant generated the body, for the "from a chat" hint
    sourceConversationId: uuid("source_conversation_id"),
    updatedBy: uuid("updated_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pages_owner_idx").on(t.ownerId),
    index("pages_visibility_idx").on(t.visibility),
  ],
);

/** Targeted grants on a private page. Exactly one of userId/divisionId is set. */
export const pageShares = pgTable(
  "page_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    divisionId: text("division_id").references(() => divisions.id, {
      onDelete: "cascade",
    }),
    /** false = read only */
    canEdit: boolean("can_edit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("page_shares_page_idx").on(t.pageId),
    index("page_shares_user_idx").on(t.userId),
    // one grant per target — re-sharing updates the existing row
    uniqueIndex("page_shares_page_user_idx").on(t.pageId, t.userId),
    uniqueIndex("page_shares_page_division_idx").on(t.pageId, t.divisionId),
  ],
);
