"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  addTemplateItem,
  createTemplate,
  deleteTemplate,
  deleteTemplateItem,
} from "@/lib/templates/service";
import { PermissionError } from "@/lib/permissions";

export interface TemplateActionState {
  error?: string;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("org.manage");
  return actor;
}

export async function createTemplateAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  try {
    const actor = await requireActor();
    await createTemplate(
      actor,
      String(formData.get("name") ?? ""),
      String(formData.get("description") ?? ""),
    );
    revalidatePath("/admin/templates");
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error && /unique/i.test(error.message)) {
      return { error: "A template with that name exists." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await deleteTemplate(actor, String(formData.get("templateId")));
  revalidatePath("/admin/templates");
}

export async function addItemAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  try {
    const actor = await requireActor();
    await addTemplateItem(actor, {
      templateId: String(formData.get("templateId")),
      divisionId: String(formData.get("divisionId")),
      title: String(formData.get("title") ?? ""),
      priority: (String(formData.get("priority")) || "medium") as
        | "low"
        | "medium"
        | "high"
        | "urgent",
      offsetDays: Number(formData.get("offsetDays") ?? 0),
    });
    revalidatePath("/admin/templates");
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await deleteTemplateItem(actor, String(formData.get("itemId")));
  revalidatePath("/admin/templates");
}
