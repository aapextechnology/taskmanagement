import type { Metadata } from "next";
import { TaskDetailPanel } from "./task-detail-panel";

export const metadata: Metadata = { title: "Task" };

// Full-page fallback: direct links / refresh. In-app clicks are intercepted
// by the @modal slot and open the peek drawer instead (T-111).
export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <TaskDetailPanel taskId={id} />
    </div>
  );
}
