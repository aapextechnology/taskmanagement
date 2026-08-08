"use client";

import { ImageIcon, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { commentAction } from "@/app/(app)/tasks/actions";
import { AttachmentView } from "@/components/attachment-view";
import { CommentBody } from "@/components/comment-body";
import { UserAvatar } from "@/components/task-meta";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThreadComment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  mentionNames: string[];
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Socmed thread behavior (Owner feedback): clicking the comment count opens
// the EXISTING thread inline; replying joins that thread — it never spawns a
// new timeline post (the feed shows one card per task).
export function ThreadView({
  taskId,
  commentCount,
}: {
  taskId: string;
  commentCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<ThreadComment[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadThread = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/timeline/thread?taskId=${taskId}`);
      if (response.ok) {
        const data = (await response.json()) as { comments: ThreadComment[] };
        setThread(data.comments);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && thread.length === 0) await loadThread();
  };

  const submitReply = (formData: FormData) => {
    startTransition(async () => {
      await commentAction({}, formData);
      formRef.current?.reset();
      setFileName(null);
      await loadThread();
      router.refresh(); // updates the card preview + counts
    });
  };

  return (
    <div className="flex flex-col gap-2 pt-1">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
          open && "text-foreground",
        )}
      >
        <MessageCircle className="size-3.5" />
        {commentCount} comment{commentCount === 1 ? "" : "s"}
      </button>

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
          {loading ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Loading thread…
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {thread.map((comment) => (
                <li key={comment.id} className="flex gap-2.5">
                  <UserAvatar
                    name={comment.authorName}
                    className="mt-0.5 size-6 text-[9px]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {comment.authorName}
                      </span>{" "}
                      · {timeAgo(comment.createdAt)}
                    </span>
                    <CommentBody
                      body={comment.body}
                      mentionNames={comment.mentionNames}
                    />
                    {comment.attachmentPath ? (
                      <AttachmentView
                        path={comment.attachmentPath}
                        name={comment.attachmentName}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* reply joins THIS thread */}
          <form
            ref={formRef}
            action={submitReply}
            className="flex flex-col gap-1.5 border-t pt-3"
          >
            <input type="hidden" name="taskId" value={taskId} />
            <div className="flex items-center gap-2">
              <input
                name="body"
                placeholder="Reply to this thread… (@all pings the division)"
                className="border-input h-9 flex-1 rounded-full border bg-transparent px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <input
                ref={fileRef}
                type="file"
                name="attachment"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Attach image or file"
                onClick={() => fileRef.current?.click()}
              >
                <ImageIcon className="size-4" />
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "…" : "Reply"}
              </Button>
            </div>
            {fileName ? (
              <span className="text-xs text-muted-foreground">📎 {fileName}</span>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
