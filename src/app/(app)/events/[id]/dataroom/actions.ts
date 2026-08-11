"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  addFolderMember,
  createFolder,
  createShare,
  listSharesFor,
  removeFolderMember,
  restoreFile,
  revokeShare,
  trashFile,
} from "@/lib/dataroom/service";
import { parseAllowedEmails } from "@/lib/dataroom/share-rules";
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

export async function addMemberAction(
  _prev: DataroomActionState,
  formData: FormData,
): Promise<DataroomActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  const eventId = String(formData.get("eventId") ?? "");
  try {
    await addFolderMember(
      actor,
      String(formData.get("folderId") ?? ""),
      String(formData.get("userId") ?? ""),
      formData.get("canEdit") === "on",
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not add that person.",
    };
  }
  revalidatePath(`/events/${eventId}/dataroom`);
  return { ok: true };
}

export async function removeMemberAction(
  _prev: DataroomActionState,
  formData: FormData,
): Promise<DataroomActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  const eventId = String(formData.get("eventId") ?? "");
  try {
    await removeFolderMember(
      actor,
      String(formData.get("folderId") ?? ""),
      String(formData.get("userId") ?? ""),
    );
  } catch (error) {
    // the orphan guard lands here; its message explains the consequence
    return {
      error: error instanceof Error ? error.message : "Could not remove them.",
    };
  }
  revalidatePath(`/events/${eventId}/dataroom`);
  return { ok: true };
}

export interface ShareActionState {
  error?: string;
  /** shown once, then never again — the plaintext token is not stored */
  url?: string;
  expiresAt?: string;
}

export async function createShareAction(
  _prev: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  const eventId = String(formData.get("eventId") ?? "");
  try {
    const created = await createShare(actor, String(formData.get("fileId") ?? ""), {
      expiryDays: Number(formData.get("expiryDays") ?? 14),
      passcode: String(formData.get("passcode") ?? "") || undefined,
      allowedEmails: parseAllowedEmails(String(formData.get("allowedEmails") ?? "")),
      allowDownload: formData.get("allowDownload") === "on",
      watermark: formData.get("watermark") === "on",
      label: String(formData.get("label") ?? "") || undefined,
    });
    revalidatePath(`/events/${eventId}/dataroom`);
    return { url: created.url, expiresAt: created.expiresAt.toISOString() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create the link.",
    };
  }
}

export async function revokeShareAction(formData: FormData): Promise<void> {
  const actor = await sessionActor();
  if (!actor) return;
  const eventId = String(formData.get("eventId") ?? "");
  await revokeShare(
    actor,
    String(formData.get("fileId") ?? ""),
    String(formData.get("linkId") ?? ""),
  ).catch(() => {});
  revalidatePath(`/events/${eventId}/dataroom`);
}

export async function listSharesAction(fileId: string) {
  const actor = await sessionActor();
  if (!actor) return [];
  return listSharesFor(actor, fileId).catch(() => []);
}
