"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  addPhase,
  createEvent,
  updateEvent,
  deletePhase,
  movePhase,
  recomputeEventHealth,
  renamePhase,
  setArchived,
  setCurrentPhase,
  setEventDivisions,
  setEventPeople,
} from "@/lib/events/service";
import { PermissionError } from "@/lib/permissions";
import { parseWibInput } from "@/lib/tasks/dates";
import { saveImageUpload } from "@/lib/uploads";

export interface EventActionState {
  error?: string;
  info?: string;
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

    // parsed AS WIB — a bare new Date() would read the picker's value in the
    // container's zone (UTC) and shift every show time seven hours
    const showDate = parseWibInput(String(formData.get("showDate") ?? ""));
    if (!showDate) {
      return { error: "Show date is invalid." };
    }

    let coverImagePath: string | undefined;
    const poster = formData.get("poster");
    if (poster instanceof File && poster.size > 0) {
      coverImagePath = await saveImageUpload(poster, "posters");
    }

    const capacityRaw = String(formData.get("capacity") ?? "");
    const event = await createEvent(actor, {
      color: String(formData.get("color") ?? "") || null,
      name: String(formData.get("name") ?? ""),
      artists: String(formData.get("artists") ?? ""),
      venue: String(formData.get("venue") ?? ""),
      showDate,
      capacity: capacityRaw ? Number(capacityRaw) : undefined,
      coverImagePath,
      picId: String(formData.get("picId") ?? "") || null,
      memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
    });
    // optional playbook (T-092): generate every division's checklist with
    // due dates counted back from show day
    const templateId = String(formData.get("templateId") ?? "");
    if (templateId) {
      const { applyTemplate } = await import("@/lib/templates/service");
      await applyTemplate(actor, event.id, templateId);
    }

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

export async function updateEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  let eventId: string;
  try {
    const actor = await requireActor();
    eventId = String(formData.get("eventId"));

    const showDate = parseWibInput(String(formData.get("showDate") ?? ""));
    if (!showDate) {
      return { error: "Show date is invalid." };
    }

    // no upload = keep the current poster; a replacement overwrites the path
    let coverImagePath: string | undefined;
    const poster = formData.get("poster");
    if (poster instanceof File && poster.size > 0) {
      coverImagePath = await saveImageUpload(poster, "posters");
    }

    const capacityRaw = String(formData.get("capacity") ?? "");
    await updateEvent(actor, eventId, {
      name: String(formData.get("name") ?? ""),
      artists: String(formData.get("artists") ?? ""),
      venue: String(formData.get("venue") ?? ""),
      showDate,
      capacity: capacityRaw ? Number(capacityRaw) : null,
      color: String(formData.get("color") ?? "") || null,
      coverImagePath,
    });
    await setEventPeople(actor, eventId, {
      picId: String(formData.get("picId") ?? "") || null,
      memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
    });
    await recomputeEventHealth(eventId);
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function setCurrentPhaseAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await setCurrentPhase(actor, eventId, String(formData.get("phaseId")));
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
}

export async function phaseManageAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    const op = String(formData.get("op"));
    if (op === "add") {
      await addPhase(actor, eventId, String(formData.get("name") ?? ""));
    } else if (op === "rename") {
      await renamePhase(
        actor,
        String(formData.get("phaseId")),
        String(formData.get("name") ?? ""),
      );
    } else if (op === "delete") {
      await deletePhase(actor, String(formData.get("phaseId")));
    } else if (op === "up" || op === "down") {
      await movePhase(actor, String(formData.get("phaseId")), op);
    }
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/events");
    return {};
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
}

export async function applyTemplateAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    const { applyTemplate } = await import("@/lib/templates/service");
    const result = await applyTemplate(
      actor,
      eventId,
      String(formData.get("templateId")),
    );
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/board`);
    return {
      error: undefined,
      info: `${result.created} tasks created${result.skipped > 0 ? `, ${result.skipped} already existed` : ""}.`,
    };
  } catch (error) {
    if (error instanceof PermissionError) return { error: "Not allowed." };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
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
