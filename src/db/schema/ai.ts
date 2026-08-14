import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./org";
import { events } from "./events";

// AI assistant persistence (EPIC-014 T-141). Conversations are PRIVATE to
// their creator — every query in src/lib/ai/conversations.ts filters by
// userId. Groups are user-defined folders; a null groupId = "Ungrouped".

export const aiConversationGroups = pgTable(
  "ai_conversation_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("ai_groups_user_name_idx").on(t.userId, t.name)],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // deleting a group NEVER deletes its chats — they fall back to Ungrouped
    groupId: uuid("group_id").references(() => aiConversationGroups.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("New chat"),
    // event focus the conversation was started with (context scoping)
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId)],
);

// Files attached to a chat message (EPIC-016 T-161). The extracted TEXT is
// not stored — it only ever lived in one prompt, and keeping it would
// duplicate the document. The original file is kept so the user can open
// what they sent; `chars`/`truncated` record what the model actually saw.
export const aiAttachments = pgTable(
  "ai_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => aiMessages.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    // relative to UPLOADS_DIR, served through the auth-gated /api/files
    filePath: text("file_path").notNull(),
    kind: text("kind", { enum: ["text", "image"] }).notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    /** characters of extracted text sent to the model; 0 for images */
    chars: integer("chars").notNull().default(0),
    truncated: boolean("truncated").notNull().default(false),
    /** why it could not be read, when it could not */
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_attachments_message_idx").on(t.messageId)],
);
