"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { PermissionError } from "@/lib/permissions";
import {
  addAttachment,
  addChecklistItem,
  addComment,
  addDependency,
  addLabelToTask,
  assignUser,
  createTask,
  decideHandoff,
  removeLabelFromTask,
  requestHandoff,
  toggleChecklistItem,
  toggleWatch,
  unassignUser,
  updateStatus,
  updateTaskFields,
  type TaskStatus,
} from "@/lib/tasks/service";
import { saveFileUpload } from "@/lib/uploads";

export interface TaskActionState {
  error?: string;
}

async function requireActor() {
  const actor = await sessionActor();
  if (!actor) throw new PermissionError("task.viewDivision");
  return actor;
}

function friendly(error: unknown): TaskActionState {
  if (error instanceof PermissionError) return { error: "Not allowed." };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  let taskId: string;
  try {
    const actor = await requireActor();
    const dueRaw = String(formData.get("dueDate") ?? "");
    const task = await createTask(actor, {
      eventId: String(formData.get("eventId")),
      divisionId: String(formData.get("divisionId")),
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      priority: (String(formData.get("priority")) || "medium") as
        | "low"
        | "medium"
        | "high"
        | "urgent",
      dueDate: dueRaw ? new Date(dueRaw) : undefined,
      recurrence: (String(formData.get("recurrence")) || "none") as
        | "none"
        | "daily"
        | "weekly"
        | "monthly",
      assigneeIds: formData.getAll("assignees").map(String).filter(Boolean),
    });
    taskId = task.id;
  } catch (error) {
    return friendly(error);
  }
  revalidatePath("/my-tasks");
  redirect(`/tasks/${taskId}`);
}

export async function updateStatusAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  await updateStatus(actor, taskId, String(formData.get("status")) as TaskStatus);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/my-tasks");
}

export async function updateFieldsAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  try {
    const actor = await requireActor();
    const taskId = String(formData.get("taskId"));
    const dueRaw = String(formData.get("dueDate") ?? "");
    await updateTaskFields(actor, taskId, {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? ""),
      priority: String(formData.get("priority")) as
        | "low"
        | "medium"
        | "high"
        | "urgent",
      dueDate: dueRaw ? new Date(dueRaw) : null,
      recurrence: String(formData.get("recurrence")) as
        | "none"
        | "daily"
        | "weekly"
        | "monthly",
    });
    revalidatePath(`/tasks/${taskId}`);
    return {};
  } catch (error) {
    return friendly(error);
  }
}

export async function assignAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  await assignUser(actor, taskId, String(formData.get("userId")));
  revalidatePath(`/tasks/${taskId}`);
}

export async function unassignAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  await unassignUser(actor, taskId, String(formData.get("userId")));
  revalidatePath(`/tasks/${taskId}`);
}

export async function watchAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  await toggleWatch(actor, taskId);
  revalidatePath(`/tasks/${taskId}`);
}

export async function checklistAddAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  const title = String(formData.get("title") ?? "").trim();
  if (title) await addChecklistItem(actor, taskId, title);
  revalidatePath(`/tasks/${taskId}`);
}

export async function checklistToggleAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await toggleChecklistItem(actor, String(formData.get("itemId")));
  revalidatePath(`/tasks/${String(formData.get("taskId"))}`);
}

export async function labelAddAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  await addLabelToTask(actor, taskId, String(formData.get("name") ?? ""));
  revalidatePath(`/tasks/${taskId}`);
}

export async function labelRemoveAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const taskId = String(formData.get("taskId"));
  await removeLabelFromTask(actor, taskId, String(formData.get("labelId")));
  revalidatePath(`/tasks/${taskId}`);
}

export async function dependencyAddAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  try {
    const actor = await requireActor();
    const taskId = String(formData.get("taskId"));
    await addDependency(actor, taskId, String(formData.get("dependsOnTaskId")));
    revalidatePath(`/tasks/${taskId}`);
    return {};
  } catch (error) {
    return friendly(error);
  }
}

export async function commentAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  try {
    const actor = await requireActor();
    const taskId = String(formData.get("taskId"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return { error: "Comment is empty." };
    await addComment(
      actor,
      taskId,
      body,
      formData.getAll("mentions").map(String).filter(Boolean),
    );
    revalidatePath(`/tasks/${taskId}`);
    return {};
  } catch (error) {
    return friendly(error);
  }
}

export async function attachmentAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  try {
    const actor = await requireActor();
    const taskId = String(formData.get("taskId"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a file first." };
    }
    const relativePath = await saveFileUpload(file, "attachments");
    await addAttachment(actor, taskId, {
      name: file.name,
      size: file.size,
      path: relativePath,
    });
    revalidatePath(`/tasks/${taskId}`);
    return {};
  } catch (error) {
    return friendly(error);
  }
}

export async function handoffRequestAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  try {
    const actor = await requireActor();
    const eventId = String(formData.get("eventId"));
    await requestHandoff(actor, {
      eventId,
      fromDivisionId: String(formData.get("fromDivisionId")),
      toDivisionId: String(formData.get("toDivisionId")),
      title: String(formData.get("title") ?? "").trim(),
      note: String(formData.get("note") ?? ""),
      originTaskId: String(formData.get("originTaskId") ?? "") || undefined,
    });
    revalidatePath(`/events/${eventId}/handoffs`);
    return {};
  } catch (error) {
    return friendly(error);
  }
}

export async function handoffDecideAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const eventId = String(formData.get("eventId"));
  await decideHandoff(
    actor,
    String(formData.get("handoffId")),
    formData.get("accept") === "true",
  );
  revalidatePath(`/events/${eventId}/handoffs`);
}
