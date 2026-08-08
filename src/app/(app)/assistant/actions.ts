"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createGroup,
  deleteConversation,
  deleteGroup,
  moveConversation,
} from "@/lib/ai/conversations";
import { sessionActor } from "@/lib/auth/session-actor";
import { PermissionError } from "@/lib/permissions";

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("ai.assistant");
  return actor;
}

export async function createGroupAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const actor = await requireActor();
    await createGroup(actor, String(formData.get("name") ?? ""));
    revalidatePath("/assistant");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof PermissionError
          ? "Not allowed."
          : error instanceof Error
            ? error.message
            : "Failed.",
    };
  }
}

export async function deleteGroupAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await deleteGroup(actor, String(formData.get("groupId")));
  revalidatePath("/assistant");
}

export async function moveConversationAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await moveConversation(
    actor,
    String(formData.get("conversationId")),
    String(formData.get("groupId") ?? "") || null,
  );
  revalidatePath("/assistant");
}

export async function deleteConversationAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const conversationId = String(formData.get("conversationId"));
  await deleteConversation(actor, conversationId);
  revalidatePath("/assistant");
  // if the user was inside the deleted chat, land them on a fresh one
  if (formData.get("active") === "true") redirect("/assistant");
}
