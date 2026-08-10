import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  aiAttachments,
  aiConversationGroups,
  aiConversations,
  aiMessages,
} from "@/db/schema";
import { assertCan, type Actor } from "@/lib/permissions";

// Conversation persistence for the AI assistant (EPIC-014 T-141).
// Conversations are PRIVATE: every read/write here filters by actor.id —
// there is no cross-user access path, not even for the owner role.

function assertAssistant(actor: Actor) {
  assertCan(actor, "ai.assistant");
}

// ---- groups ---------------------------------------------------------------

export async function createGroup(actor: Actor, name: string) {
  assertAssistant(actor);
  const clean = name.trim();
  if (!clean) throw new Error("Group name is empty.");
  const [group] = await db
    .insert(aiConversationGroups)
    .values({ userId: actor.id, name: clean })
    .onConflictDoNothing()
    .returning();
  if (!group) throw new Error("You already have a group with that name.");
  return group;
}

export async function deleteGroup(actor: Actor, groupId: string) {
  assertAssistant(actor);
  // FK is ON DELETE SET NULL — chats survive and fall back to Ungrouped
  await db
    .delete(aiConversationGroups)
    .where(
      and(
        eq(aiConversationGroups.id, groupId),
        eq(aiConversationGroups.userId, actor.id),
      ),
    );
}

// ---- conversations --------------------------------------------------------

export async function createConversation(
  actor: Actor,
  input: { title: string; eventId?: string | null; groupId?: string | null },
) {
  assertAssistant(actor);
  const [conversation] = await db
    .insert(aiConversations)
    .values({
      userId: actor.id,
      title: input.title.trim().slice(0, 80) || "New chat",
      eventId: input.eventId ?? null,
      groupId: input.groupId ?? null,
    })
    .returning();
  return conversation;
}

/** Owned conversation or null — the single ownership check everything uses. */
export async function getConversation(actor: Actor, conversationId: string) {
  assertAssistant(actor);
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, actor.id),
      ),
    )
    .limit(1);
  return conversation ?? null;
}

export async function getConversationWithMessages(
  actor: Actor,
  conversationId: string,
) {
  const conversation = await getConversation(actor, conversationId);
  if (!conversation) return null;
  const messages = await db
    .select({
      role: aiMessages.role,
      content: aiMessages.content,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));
  return { ...conversation, messages };
}

export async function appendExchange(
  actor: Actor,
  conversationId: string,
  userContent: string,
  assistantContent: string,
) {
  const conversation = await getConversation(actor, conversationId);
  if (!conversation) throw new Error("Conversation not found.");
  // ids come back so the caller can hang attachments off the user turn
  const [userMessage] = await db
    .insert(aiMessages)
    .values([
      { conversationId, role: "user" as const, content: userContent },
      { conversationId, role: "assistant" as const, content: assistantContent },
    ])
    .returning({ id: aiMessages.id });
  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId));
  return { userMessageId: userMessage?.id ?? null };
}

/** Records what was attached to a user turn (EPIC-016 T-161). */
export async function saveAttachments(
  messageId: string,
  rows: Array<{
    fileName: string;
    filePath: string;
    kind: "text" | "image";
    sizeBytes: number;
    chars: number;
    truncated: boolean;
    error: string | null;
  }>,
) {
  if (rows.length === 0) return;
  await db.insert(aiAttachments).values(rows.map((r) => ({ ...r, messageId })));
}

export async function moveConversation(
  actor: Actor,
  conversationId: string,
  groupId: string | null,
) {
  assertAssistant(actor);
  if (groupId) {
    // the target group must be the actor's own
    const [group] = await db
      .select({ id: aiConversationGroups.id })
      .from(aiConversationGroups)
      .where(
        and(
          eq(aiConversationGroups.id, groupId),
          eq(aiConversationGroups.userId, actor.id),
        ),
      )
      .limit(1);
    if (!group) throw new Error("Group not found.");
  }
  await db
    .update(aiConversations)
    .set({ groupId, updatedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, actor.id),
      ),
    );
}

export async function deleteConversation(
  actor: Actor,
  conversationId: string,
) {
  assertAssistant(actor);
  await db
    .delete(aiConversations)
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, actor.id),
      ),
    );
}

// ---- history listing ------------------------------------------------------

export interface ConversationListItem {
  id: string;
  title: string;
  groupId: string | null;
  updatedAt: Date;
}

export async function listHistory(actor: Actor): Promise<{
  groups: Array<{ id: string; name: string; conversations: ConversationListItem[] }>;
  ungrouped: ConversationListItem[];
}> {
  assertAssistant(actor);
  const [groups, conversations] = await Promise.all([
    db
      .select()
      .from(aiConversationGroups)
      .where(eq(aiConversationGroups.userId, actor.id))
      .orderBy(asc(aiConversationGroups.name)),
    db
      .select({
        id: aiConversations.id,
        title: aiConversations.title,
        groupId: aiConversations.groupId,
        updatedAt: aiConversations.updatedAt,
      })
      .from(aiConversations)
      .where(eq(aiConversations.userId, actor.id))
      .orderBy(desc(aiConversations.updatedAt)),
  ]);

  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      conversations: conversations.filter((c) => c.groupId === group.id),
    })),
    ungrouped: conversations.filter((c) => c.groupId === null),
  };
}
