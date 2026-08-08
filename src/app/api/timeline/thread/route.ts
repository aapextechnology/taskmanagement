import { NextResponse } from "next/server";
import { sessionActor } from "@/lib/auth/session-actor";
import { getThread } from "@/lib/timeline/service";

// Existing comment thread of a task, for the timeline's expandable view.
export async function GET(request: Request) {
  const actor = await sessionActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }
  const thread = await getThread(actor, taskId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    comments: thread.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.authorName,
      createdAt: c.createdAt.toISOString(),
      attachmentPath: c.attachmentPath,
      attachmentName: c.attachmentName,
      mentionNames: c.mentionNames,
    })),
  });
}
