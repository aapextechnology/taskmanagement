"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  createPage,
  deletePage,
  setPageVisibility,
  sharePage,
  unsharePage,
  updatePage,
} from "@/lib/pages/standalone-service";
import { PermissionError } from "@/lib/permissions";

// Server actions for the standalone Pages module (EPIC-016 T-160). Every
// action re-resolves permission inside the service — none of them trust the
// page id coming from the browser.

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("page.use");
  return actor;
}

export async function createPageAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const page = await createPage(actor, {
    title: String(formData.get("title") ?? ""),
  });
  redirect(`/pages/${page.id}`);
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
      error: error instanceof PermissionError ? "Not allowed." : "Save failed.",
    };
  }
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await deletePage(actor, String(formData.get("pageId")));
  revalidatePath("/pages");
  redirect("/pages");
}

export interface ShareActionState {
  error?: string;
  ok?: boolean;
}

export async function shareAction(
  _prev: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  try {
    const actor = await requireActor();
    const pageId = String(formData.get("pageId"));
    const target = String(formData.get("target") ?? "");
    // the form sends "user:<id>" or "division:<id>" so one control covers both
    const [kind, id] = target.split(":");
    if (!id) return { error: "Choose someone to share with." };

    await sharePage(actor, pageId, {
      ...(kind === "division" ? { divisionId: id } : { userId: id }),
      canEdit: formData.get("canEdit") === "on",
    });
    revalidatePath(`/pages/${pageId}`);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof PermissionError
          ? "Only the author can share this page."
          : error instanceof Error
            ? error.message
            : "Could not share.",
    };
  }
}

export async function unshareAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const pageId = String(formData.get("pageId"));
  await unsharePage(actor, pageId, String(formData.get("shareId")));
  revalidatePath(`/pages/${pageId}`);
}

export async function visibilityAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const pageId = String(formData.get("pageId"));
  const visibility =
    String(formData.get("visibility")) === "organisation"
      ? "organisation"
      : "private";
  await setPageVisibility(actor, pageId, visibility);
  revalidatePath(`/pages/${pageId}`);
}
