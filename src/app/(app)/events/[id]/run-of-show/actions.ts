"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import { PermissionError } from "@/lib/permissions";
import {
  addRunOfShowItem,
  deleteRunOfShowItem,
  updateRunOfShowItem,
} from "@/lib/run-of-show/service";

export interface RosActionState {
  error?: string;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("runofshow.manage");
  return actor;
}

function parse(formData: FormData) {
  const durationRaw = String(formData.get("durationMinutes") ?? "");
  return {
    startTime: String(formData.get("startTime") ?? ""),
    durationMinutes: durationRaw ? Number(durationRaw) : undefined,
    title: String(formData.get("title") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

export async function rosAddAction(
  _prev: RosActionState,
  formData: FormData,
): Promise<RosActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    await addRunOfShowItem(actor, { eventId, ...parse(formData) });
    revalidatePath(`/events/${eventId}/run-of-show`);
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function rosUpdateAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await updateRunOfShowItem(actor, String(formData.get("itemId")), parse(formData));
  revalidatePath(`/events/${eventId}/run-of-show`);
}

export async function rosDeleteAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await deleteRunOfShowItem(actor, String(formData.get("itemId")));
  revalidatePath(`/events/${eventId}/run-of-show`);
}
