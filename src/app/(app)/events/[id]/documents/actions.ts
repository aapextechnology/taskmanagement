"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import { createDocument } from "@/lib/documents/service";
import { PermissionError } from "@/lib/permissions";

export interface DocumentActionState {
  error?: string;
}

export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const actor = await sessionActor();
    if (!actor) throw new PermissionError("document.manage");

    const eventId = String(formData.get("eventId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a file to upload." };
    }

    await createDocument(actor, {
      eventId,
      divisionId: String(formData.get("divisionId") ?? ""),
      category: String(formData.get("category") ?? ""),
      title: String(formData.get("title") ?? ""),
      file,
    });

    revalidatePath(`/events/${eventId}/documents`);
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}
