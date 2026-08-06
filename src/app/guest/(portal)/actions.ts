"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { saveSubmission } from "@/lib/external/service";
import type { FormType } from "@/lib/external/forms";
import { FORM_DEFINITIONS } from "@/lib/external/forms";

export interface GuestFormState {
  error?: string;
  saved?: boolean;
}

export async function guestFormAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "external") {
    redirect("/guest/login");
  }

  const type = String(formData.get("type")) as FormType;
  const definition = FORM_DEFINITIONS[type];
  if (!definition) return { error: "Unknown form." };

  const data: Record<string, unknown> = {};
  for (const field of definition.fields) {
    data[field.key] = String(formData.get(field.key) ?? "");
  }

  const submit = formData.get("intent") === "submit";
  try {
    await saveSubmission(session.user.id, { type, data, submit });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  if (submit) redirect("/guest");
  return { saved: true };
}
