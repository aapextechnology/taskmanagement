import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sessionActor } from "@/lib/auth/session-actor";
import { getPage } from "@/lib/pages/service";
import { can } from "@/lib/permissions";
import { deletePageAction } from "../actions";
import { PageEditor } from "./page-editor";

export const metadata: Metadata = { title: "Page" };

// One event page: title + rich-text editor, autosaving (Owner 2026-08-07).
export default async function EventPageDetail({
  params,
}: PageProps<"/events/[id]/pages/[pageId]">) {
  const actor = await sessionActor();
  if (!actor || !can(actor, "event.view")) redirect("/login");

  const { id, pageId } = await params;
  const page = await getPage(actor, pageId);
  if (!page || page.eventId !== id) notFound();

  const mayDelete = page.createdBy === actor.id || can(actor, "org.manage");

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/events/${id}/pages`}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {page.eventName} · pages
        </Link>
        {mayDelete ? (
          <form action={deletePageAction}>
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="pageId" value={page.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </form>
        ) : null}
      </div>

      <PageEditor
        pageId={page.id}
        initialTitle={page.title}
        initialContent={page.content}
      />
    </section>
  );
}
