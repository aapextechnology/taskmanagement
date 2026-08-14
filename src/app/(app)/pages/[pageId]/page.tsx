import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { PageEditor } from "@/components/page-editor";
import { Button } from "@/components/ui/button";
import { sessionActor } from "@/lib/auth/session-actor";
import { listDivisions, listUsersWithMemberships } from "@/lib/org/service";
import { getPage, listShares } from "@/lib/pages/standalone-service";
import { can } from "@/lib/permissions";
import { deletePageAction, savePageAction } from "../actions";
import { SharePanel } from "./share-panel";

export const metadata: Metadata = { title: "Page" };

// One standalone page (EPIC-016 T-160). getPage returns null both when the
// page is missing and when the actor may not see it, so a private page is
// indistinguishable from a non-existent one.
export default async function StandalonePageDetail({
  params,
}: PageProps<"/pages/[pageId]">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");
  if (!can(actor, "page.use")) redirect("/my-tasks");

  const { pageId } = await params;
  const page = await getPage(actor, pageId);
  if (!page) notFound();

  // sharing controls are author-only, so their data is fetched only then
  const [shares, people, divisions] = page.access.canManage
    ? await Promise.all([
        listShares(actor, pageId),
        listUsersWithMemberships(),
        listDivisions(),
      ])
    : [[], [], []];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/pages"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← Pages
        </Link>
        <div className="flex items-center gap-2">
          {!page.access.canEdit ? (
            <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Eye className="size-3" /> Read only
              {page.ownerName ? ` · ${page.ownerName}` : ""}
            </span>
          ) : null}
          {page.access.canManage ? (
            <form action={deletePageAction}>
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
      </div>

      <PageEditor
        pageId={page.id}
        initialTitle={page.title}
        initialContent={page.content}
        save={savePageAction}
        editable={page.access.canEdit}
      />

      {page.access.canManage ? (
        <SharePanel
          pageId={page.id}
          visibility={page.visibility}
          shares={shares.map((s) => ({
            id: s.id,
            canEdit: s.canEdit,
            userName: s.userName,
            divisionName: s.divisionName,
          }))}
          people={people
            .filter((u) => u.role !== "external" && u.id !== actor.id)
            .map((u) => ({ id: u.id, name: u.name }))}
          divisions={divisions.map((d) => ({ id: d.id, name: d.name }))}
        />
      ) : null}
    </section>
  );
}
