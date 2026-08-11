import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { events } from "./events";
import { divisions, profiles } from "./org";

// Dataroom (EPIC-017). One room per event; the bytes live on the 3.6 TB disk
// behind src/lib/dataroom/storage.ts, and this schema is only the index.
//
// Replaces the per-event `documents` module, which never held a file.

export const dataroomVisibilityEnum = pgEnum("dataroom_visibility", [
  "sealed", // only the people listed in dataroom_folder_members
  "division", // one division's members (+ owner/admin)
  "event", // anyone who can view the event
  "organisation", // every internal user
]);

export const dataroomFolders = pgTable(
  "dataroom_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // null = a top-level folder in this event's room
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    visibility: dataroomVisibilityEnum("visibility").notNull().default("event"),
    // required when visibility = 'division'; access denies when it is missing
    divisionId: text("division_id").references(() => divisions.id, {
      onDelete: "restrict",
    }),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dataroom_folders_event_idx").on(t.eventId),
    index("dataroom_folders_parent_idx").on(t.parentId),
  ],
);

/** Explicit grants — only meaningful for a sealed folder. */
export const dataroomFolderMembers = pgTable(
  "dataroom_folder_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => dataroomFolders.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** false = read only */
    canEdit: boolean("can_edit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dataroom_folder_members_folder_idx").on(t.folderId),
    // one grant per person; re-sharing updates the existing row
    uniqueIndex("dataroom_folder_members_folder_user_idx").on(t.folderId, t.userId),
  ],
);

export const dataroomFiles = pgTable(
  "dataroom_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // denormalised from the folder so quota sums never need a join
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => dataroomFolders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** which version is current; every earlier one is still on disk */
    currentVersion: integer("current_version").notNull().default(1),
    // trash: the bytes stay (and keep counting against the quota) until a
    // purge job removes them after the retention window
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    trashedBy: uuid("trashed_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dataroom_files_event_idx").on(t.eventId),
    index("dataroom_files_folder_idx").on(t.folderId),
    index("dataroom_files_trashed_idx").on(t.trashedAt),
  ],
);

/** Never overwritten: a careless re-upload cannot destroy a signed contract. */
export const dataroomFileVersions = pgTable(
  "dataroom_file_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => dataroomFiles.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    // bigint: a 3.6 TB disk outgrows a 32-bit byte count
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    mimeType: text("mime_type").notNull().default("application/octet-stream"),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dataroom_file_versions_file_idx").on(t.fileId),
    uniqueIndex("dataroom_file_versions_file_no_idx").on(t.fileId, t.versionNo),
  ],
);

export const dataroomActionEnum = pgEnum("dataroom_action", [
  "view",
  "download",
  "upload",
  "trash",
  "restore",
]);

/**
 * Who opened what, and when.
 *
 * Deliberately carries NO foreign key to the file, and denormalises its name:
 * the record of who read a contract must outlive the contract. A purge that
 * erased the audit alongside the bytes would defeat the point of the room.
 */
export const dataroomAccessLog = pgTable(
  "dataroom_access_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    /** kept as a plain column, not a reference — see above */
    fileId: uuid("file_id").notNull(),
    /**
     * Also denormalised, and for a different reason: the activity view has to
     * be filtered by the SAME access rules as the files themselves, or it
     * would list the names of sealed documents to everyone who can see the
     * event — defeating the folder it is meant to audit.
     */
    folderId: uuid("folder_id"),
    eventId: uuid("event_id").notNull(),
    fileName: text("file_name").notNull(),
    versionNo: integer("version_no"),
    action: dataroomActionEnum("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("dataroom_access_log_file_idx").on(t.fileId),
    index("dataroom_access_log_event_idx").on(t.eventId),
    index("dataroom_access_log_actor_idx").on(t.actorId),
  ],
);
