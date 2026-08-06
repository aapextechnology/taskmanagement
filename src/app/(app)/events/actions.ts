"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  createEvent,
  recomputeEventHealth,
  setArchived,
  setEventDivisions,
  updatePhase,
  type EventPhase,
} from "@/lib/events/service";
import { PermissionError } from "@/lib/permissions";
import { saveImageUpload } from "@/lib/uploads";

export interface EventActionState {
  error?: string;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("event.view");
  return actor;
}

export async function createEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  let eventId: string;
  try {
    const actor = await requireActor();

    const showDateRaw = String(formData.get("showDate") ?? "");
    const showDate = new Date(showDateRaw);
    if (Number.isNaN(showDate.getTime())) {
      return { error: "Show date is invalid." };
    }

    let coverImagePath: string | undefined;
    const poster = formData.get("poster");
    if (poster instanceof File && poster.size > 0) {
      coverImagePath = await saveImageUpload(poster, "posters");
    }

    const capacityRaw = String(formData.get("capacity") ?? "");
    const event = await createEvent(actor, {
      name: String(formData.get("name") ?? ""),
      artists: String(formData.get("artists") ?? ""),
      venue: String(formData.get("venue") ?? ""),
      showDate,
      capacity: capacityRaw ? Number(capacityRaw) : undefined,
      coverImagePath,
    });
    await recomputeEventHealth(event.id);
    eventId = event.id;
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error && /image|limit/i.test(error.message)) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function updatePhaseAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await updatePhase(actor, eventId, String(formData.get("phase")) as EventPhase);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
}

export async function setDivisionsAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    await setEventDivisions(
      actor,
      eventId,
      formData.getAll("divisionIds").map(String).filter(Boolean),
    );
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/board`);
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function archiveEventAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await setArchived(actor, eventId, formData.get("archived") === "true");
  revalidatePath("/events");
  redirect("/events");
}
