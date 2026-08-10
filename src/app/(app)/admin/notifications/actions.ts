"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  resetWaTemplate,
  updateWaTemplate,
} from "@/lib/whatsapp/template-store";
import { TEMPLATE_SPECS, type WaTemplateKey } from "@/lib/whatsapp/templates";

export interface TemplateActionState {
  /** which card the result belongs to, so one card's error never shows on another */
  key?: WaTemplateKey;
  ok?: boolean;
  error?: string;
}

function readKey(formData: FormData): WaTemplateKey | null {
  const raw = String(formData.get("key") ?? "");
  return TEMPLATE_SPECS.some((s) => s.key === raw)
    ? (raw as WaTemplateKey)
    : null;
}

export async function saveTemplateAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };

  const key = readKey(formData);
  if (!key) return { error: "Unknown template." };

  try {
    // permission and validation both live in the service — the action is a
    // thin wrapper so the API surface cannot be bypassed by another caller
    await updateWaTemplate(actor, key, String(formData.get("body") ?? ""));
  } catch (error) {
    return {
      key,
      error: error instanceof Error ? error.message : "Could not save.",
    };
  }
  revalidatePath("/admin/notifications");
  return { key, ok: true };
}

export async function resetTemplateAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };

  const key = readKey(formData);
  if (!key) return { error: "Unknown template." };

  try {
    await resetWaTemplate(actor, key);
  } catch (error) {
    return {
      key,
      error: error instanceof Error ? error.message : "Could not reset.",
    };
  }
  revalidatePath("/admin/notifications");
  return { key, ok: true };
}
