"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import { createFolder, restoreFile, trashFile } from "@/lib/dataroom/service";
import type { Visibility } from "@/lib/dataroom/access";

export interface DataroomActionState {
  error?: string;
  ok?: boolean;
}

export async function createFolderAction(
  _prev: DataroomActionState,
  formData: FormData,
): Promise<DataroomActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  const eventId = String(formData.get("eventId") ?? "");
  try {
    await createFolder(actor, {
      eventId,
      parentId: String(formData.get("parentId") ?? "") || null,
      name: String(formData.get("name") ?? ""),
      visibility: String(formData.get("visibility") ?? "event") as Visibility,
      divisionId: String(formData.get("divisionId") ?? "") || null,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create the folder.",
    };
  }
  revalidatePath(`/events/${eventId}/dataroom`);
  return { ok: true };
}

export async function trashFileAction(formData: FormData): Promise<void> {
  const actor = await sessionActor();
  if (!actor) return;
  const eventId = String(formData.get("eventId") ?? "");
  await trashFile(actor, String(formData.get("fileId") ?? "")).catch(() => {});
  revalidatePath(`/events/${eventId}/dataroom`);
}

export async function restoreFileAction(formData: FormData): Promise<void> {
  const actor = await sessionActor();
  if (!actor) return;
  const eventId = String(formData.get("eventId") ?? "");
  await restoreFile(actor, String(formData.get("fileId") ?? "")).catch(() => {});
  revalidatePath(`/events/${eventId}/dataroom`);
}
