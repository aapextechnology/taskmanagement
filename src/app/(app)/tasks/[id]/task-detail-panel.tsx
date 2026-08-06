import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LabelChip } from "@/components/label-chip";
import { AvatarStack, PriorityIcon, StatusChip } from "@/components/task-meta";
import { Button } from "@/components/ui/button";
import { LABEL_COLORS } from "@/lib/label-colors";
import { Input } from "@/components/ui/input";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";
import {
  getTaskDetail,
  listDivisionMemberOptions,
  listEventTaskOptions,
  STATUS_LABELS,
  TASK_STATUS_ORDER,
} from "@/lib/tasks/service";
import {
  assignAction,
  checklistAddAction,
  checklistToggleAction,
  labelAddAction,
  labelRemoveAction,
  unassignAction,
  updateStatusAction,
  watchAction,
} from "../actions";
import { CommentForm } from "./comment-form";
import { DependencyForm } from "./dependency-form";
import { AttachmentForm } from "./attachment-form";
import { EditTaskForm } from "./edit-form";

const dt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

// Shared between the full page and the peek drawer (T-111).
export async function TaskDetailPanel({
  taskId,
  compact = false,
}: {
  taskId: string;
  compact?: boolean;
}) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const task = await getTaskDetail(actor, taskId);
  if (!task) notFound();

  const canEdit = can(actor, "task.edit", { divisionId: task.divisionId });
  const canAssign = can(actor, "task.assign", { divisionId: task.divisionId });
  const canMove =
    canEdit || can(actor, "task.updateAssigned", { isAssigned: task.isAssigned });

  const [members, taskOptions] = await Promise.all([
    listDivisionMemberOptions(task.divisionId),
    canEdit ? listEventTaskOptions(actor, task.eventId, task.id) : [],
  ]);
  const watching = task.watcherIds.includes(actor.id);

  return (
    <section className="flex w-full flex-col gap-7">
      <div className="flex flex-col gap-2">
        {!compact ? (
          <Link
            href={`/events/${task.eventId}/board?division=${task.divisionId}`}
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← {task.event?.name ?? "Event"} · board
          </Link>
        ) : (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {task.event?.name} · {task.divisionId}
          </span>
        )}
        <div className="flex items-start justify-between gap-4">
          <h1
            className={
              compact
                ? "text-xl font-semibold leading-tight tracking-tight"
                : "text-3xl font-semibold uppercase leading-tight tracking-tight"
            }
          >
            {task.title}
          </h1>
          <div className="flex items-center gap-2">
            {canEdit ? (
              <EditTaskForm
                task={{
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  dueDate: task.dueDate?.toISOString() ?? null,
                  recurrence: task.recurrence,
                }}
              />
            ) : null}
            <form action={watchAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <Button variant="ghost" size="sm" type="submit">
                {watching ? "Unwatch" : "Watch"}
              </Button>
            </form>
          </div>
        </div>
        {task.description ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {task.description}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <StatusChip status={task.status} />
          <PriorityIcon priority={task.priority} withLabel />
          {task.dueDate ? <span>due {dt.format(task.dueDate)} WIB</span> : null}
          {task.recurrence !== "none" ? <span>repeats {task.recurrence}</span> : null}
          <AvatarStack users={task.assignees} />
        </p>
      </div>

      {/* status */}
      <div className="flex flex-wrap gap-2">
        {TASK_STATUS_ORDER.map((status) => (
          <form action={updateStatusAction} key={status}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="status" value={status} />
            <Button
              type="submit"
              size="sm"
              disabled={!canMove || status === task.status}
              variant={status === task.status ? "default" : "outline"}
            >
              {STATUS_LABELS[status]}
            </Button>
          </form>
        ))}
      </div>

      {/* assignees */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Assignees
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {task.assignees.map((a) => (
            <form action={unassignAction} key={a.id}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="userId" value={a.id} />
              <button
                type="submit"
                disabled={!canAssign}
                title={canAssign ? "Remove assignee" : undefined}
                className="rounded-sm border px-2 py-1 text-xs hover:bg-accent disabled:pointer-events-none"
              >
                {a.name} {canAssign ? "×" : ""}
              </button>
            </form>
          ))}
          {canAssign ? (
            <form action={assignAction} className="flex items-center gap-2">
              <input type="hidden" name="taskId" value={task.id} />
              <select
                name="userId"
                className="border-input h-8 rounded-md border bg-transparent px-2 text-xs outline-none"
              >
                {members
                  .filter((m) => !task.assignees.some((a) => a.id === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
                Assign
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {/* checklist */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Checklist
        </h2>
        <ul className="flex flex-col gap-1">
          {task.checklist.map((item) => (
            <li key={item.id}>
              <form action={checklistToggleAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <button
                  type="submit"
                  disabled={!canMove}
                  className="flex items-center gap-2 text-sm disabled:pointer-events-none"
                >
                  <span className="flex size-4 items-center justify-center rounded-sm border text-[10px]">
                    {item.done ? "✕" : ""}
                  </span>
                  <span className={item.done ? "text-muted-foreground line-through" : ""}>
                    {item.title}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        {canMove ? (
          <form action={checklistAddAction} className="flex items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <Input name="title" placeholder="Add checklist item…" className="h-8 max-w-xs text-xs" />
            <Button type="submit" size="sm" variant="outline">
              Add
            </Button>
          </form>
        ) : null}
      </div>

      {/* labels */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">Labels</h2>
        <div className="flex flex-wrap items-center gap-2">
          {task.labels.map((label) => (
            <form action={labelRemoveAction} key={label.id} className="inline-flex">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="labelId" value={label.id} />
              <button
                type="submit"
                disabled={!canEdit}
                title={canEdit ? "Remove label" : undefined}
                className="transition-opacity hover:opacity-70 disabled:pointer-events-none"
              >
                <LabelChip name={`${label.name}${canEdit ? " ×" : ""}`} color={label.color} />
              </button>
            </form>
          ))}
          {canEdit ? (
            <form action={labelAddAction} className="flex items-center gap-2">
              <input type="hidden" name="taskId" value={task.id} />
              <Input name="name" placeholder="Add label…" className="h-8 w-32 text-xs" />
              <select
                name="color"
                className="border-input h-8 rounded-md border bg-transparent px-2 text-xs outline-none"
                defaultValue="blue"
              >
                {Object.entries(LABEL_COLORS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
                Add
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {/* dependencies */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Dependencies
        </h2>
        {task.blockers.length > 0 ? (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Blocked by</span>
            {task.blockers.map((b) => (
              <Link key={b.id} href={`/tasks/${b.id}`} className="hover:underline">
                {b.status === "done" ? "✕ " : "○ "}
                {b.title}
              </Link>
            ))}
          </div>
        ) : null}
        {task.dependents.length > 0 ? (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Blocks</span>
            {task.dependents.map((b) => (
              <Link key={b.id} href={`/tasks/${b.id}`} className="hover:underline">
                {b.title}
              </Link>
            ))}
          </div>
        ) : null}
        {canEdit && taskOptions.length > 0 ? (
          <DependencyForm taskId={task.id} options={taskOptions} />
        ) : null}
      </div>

      {/* attachments */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Attachments
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {task.attachments.map((a) => (
            <li key={a.id}>
              <a href={`/api/files/${a.path}`} className="hover:underline" download={a.fileName}>
                {a.fileName}{" "}
                <span className="text-xs text-muted-foreground">
                  ({Math.ceil(a.size / 1024)} KB)
                </span>
              </a>
            </li>
          ))}
        </ul>
        {canMove ? <AttachmentForm taskId={task.id} /> : null}
      </div>

      {/* comments */}
      <div className="flex flex-col gap-4 border-t pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Comments
        </h2>
        <ul className="flex flex-col gap-4">
          {task.comments.map(({ comment, authorName }) => (
            <li key={comment.id} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {authorName ?? "Unknown"} · {dt.format(comment.createdAt)} WIB
              </span>
              <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
            </li>
          ))}
        </ul>
        <CommentForm
          taskId={task.id}
          mentionOptions={members.map((m) => ({ id: m.id, name: m.name }))}
        />
      </div>
    </section>
  );
}
