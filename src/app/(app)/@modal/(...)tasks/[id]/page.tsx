import { TaskDetailPanel } from "@/app/(app)/tasks/[id]/task-detail-panel";
import { TaskPeek } from "./task-peek";

// Intercepted /tasks/[id]: opens as a right-side drawer over the current
// view. URL updates (shareable); refresh loads the full page.
export default async function TaskPeekPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TaskPeek>
      <TaskDetailPanel taskId={id} compact />
    </TaskPeek>
  );
}
