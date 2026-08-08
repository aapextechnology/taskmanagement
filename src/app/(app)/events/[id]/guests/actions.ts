"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import type { FormType } from "@/lib/external/forms";
import {
  createInvite,
  reviewSubmission,
  revokeInvite,
} from "@/lib/external/service";
import { PermissionError } from "@/lib/permissions";

export interface GuestAdminState {
  error?: string;
  magicLink?: string;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("external.invite");
  return actor;
}

export async function inviteAction(
  _prev: GuestAdminState,
  formData: FormData,
): Promise<GuestAdminState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    const { magicLink } = await createInvite(actor, {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      eventId,
      divisionId: String(formData.get("divisionId")),
      requestedForms: formData
        .getAll("requestedForms")
        .map(String) as FormType[],
    });
    revalidatePath(`/events/${eventId}/guests`);
    // surfaced once in the UI — handy in dev where email lands in mailpit
    return { magicLink };
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function revokeAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await revokeInvite(actor, String(formData.get("inviteId")));
  revalidatePath(`/events/${eventId}/guests`);
}

export async function reviewAction(
  _prev: GuestAdminState,
  formData: FormData,
): Promise<GuestAdminState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    await reviewSubmission(
      actor,
      String(formData.get("submissionId")),
      String(formData.get("decision")) as "accepted" | "changes_requested",
      String(formData.get("note") ?? ""),
    );
    revalidatePath(`/events/${eventId}/guests`);
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}
