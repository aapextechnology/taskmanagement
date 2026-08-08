"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { PermissionError } from "@/lib/permissions";
import {
  createPage,
  deletePage,
  updatePage,
} from "@/lib/pages/service";

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("event.view");
  return actor;
}

export async function createPageAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  const page = await createPage(actor, eventId, String(formData.get("title") ?? ""));
  redirect(`/events/${eventId}/pages/${page.id}`);
}

export async function savePageAction(
  pageId: string,
  fields: { title?: string; contentJson?: string },
): Promise<{ error?: string; savedAt?: string }> {
  try {
    const actor = await requireActor();
    await updatePage(actor, pageId, {
      title: fields.title,
      content:
        fields.contentJson !== undefined
          ? (JSON.parse(fields.contentJson) as unknown)
          : undefined,
    });
    return { savedAt: new Date().toISOString() };
  } catch (error) {
    return {
      error:
        error instanceof PermissionError ? "Not allowed." : "Save failed.",
    };
  }
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await deletePage(actor, String(formData.get("pageId")));
  revalidatePath(`/events/${eventId}/pages`);
  redirect(`/events/${eventId}/pages`);
}
