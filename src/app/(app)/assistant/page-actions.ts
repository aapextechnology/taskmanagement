"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  appendDoc,
  markdownToDoc,
  titleFromMarkdown,
} from "@/lib/pages/markdown";
import {
  createPage,
  getPage,
  listPages,
  updatePage,
} from "@/lib/pages/standalone-service";

// "Save to page" from an assistant answer (EPIC-016 T-163). The answer is
// markdown; a page stores editor JSON, so it is parsed rather than pasted.

export interface SaveToPageState {
  error?: string;
  /** id of the page written to, on success */
  pageId?: string;
  title?: string;
}

/**
 * Pages offered in the "add to existing" picker. Restricted to the actor's
 * OWN pages: the list does not carry edit rights, and a page shared with them
 * may well be read-only, so offering it would fail on save. Failing closed
 * here is better than an offer the service then refuses.
 */
export async function editablePagesAction(): Promise<
  Array<{ id: string; title: string }>
> {
  const actor = await sessionActor();
  if (!actor) return [];
  const pages = await listPages(actor).catch(() => []);
  return pages.filter((p) => p.isMine).map((p) => ({ id: p.id, title: p.title }));
}

export async function saveAnswerToPageAction(
  _prev: SaveToPageState,
  formData: FormData,
): Promise<SaveToPageState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };

  const markdown = String(formData.get("markdown") ?? "").trim();
  if (!markdown) return { error: "There is nothing to save." };

  const targetId = String(formData.get("pageId") ?? "").trim();
  const doc = markdownToDoc(markdown);
  const conversationId = String(formData.get("conversationId") ?? "").trim();

  try {
    if (targetId) {
      // append: read first so the existing body is preserved. The service
      // enforces edit permission; a stale id from the picker fails there.
      const existing = await getPage(actor, targetId);
      if (!existing) return { error: "That page is no longer available." };
      await updatePage(actor, targetId, {
        content: appendDoc(existing.content, doc),
      });
      revalidatePath(`/pages/${targetId}`);
      return { pageId: targetId, title: existing.title };
    }

    const title =
      String(formData.get("title") ?? "").trim() ||
      titleFromMarkdown(markdown, "Assistant summary");
    const page = await createPage(actor, {
      title,
      content: doc,
      sourceConversationId: conversationId || null,
    });
    revalidatePath("/pages");
    return { pageId: page.id, title };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save to a page.",
    };
  }
}
