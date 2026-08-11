import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  eventUsage,
  listFiles,
  listFolders,
  listFolderMembers,
} from "@/lib/dataroom/service";
import { formatBytes } from "@/lib/dataroom/quota";
import { listDivisions, listUsersWithMemberships } from "@/lib/org/service";
import { can } from "@/lib/permissions";
import { DataroomBrowser } from "./dataroom-browser";
import { SealedMembers } from "./sealed-members";

export const metadata: Metadata = { title: "Dataroom" };

// EPIC-017 T-172. Replaces the per-event Documents module.
export default async function DataroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await sessionActor();
  if (!actor || !can(actor, "event.view")) redirect("/my-tasks");

  const { id: eventId } = await params;
  const sp = await searchParams;
  const folders = await listFolders(actor, eventId);
  const openId =
    (typeof sp.f === "string" ? sp.f : undefined) ??
    folders.find((f) => !f.parentId)?.id;

  const open = folders.find((f) => f.id === openId) ?? null;
  const [files, usage, divisions, people] = await Promise.all([
    openId ? listFiles(actor, openId).catch(() => []) : Promise.resolve([]),
    eventUsage(eventId),
    listDivisions(),
    listUsersWithMemberships(),
  ]);

  // the member list is only meaningful — and only reachable — for a sealed
  // folder the actor can manage
  const members =
    open && open.visibility === "sealed" && open.canManage
      ? await listFolderMembers(actor, open.id).catch(() => [])
      : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dataroom</h1>
          <p className="text-sm text-muted-foreground">
            Documents for this event. Every open and download is recorded.
          </p>
        </div>
        <div className="flex min-w-56 flex-col gap-1.5">
          <span className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Storage</span>
            <span
              className={
                usage.level === "full"
                  ? "font-medium text-destructive"
                  : usage.level === "warning"
                    ? "font-medium text-priority-high"
                    : "text-muted-foreground"
              }
            >
              {formatBytes(usage.usedBytes)} of {formatBytes(usage.limitBytes)}
            </span>
          </span>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={
                usage.level === "full"
                  ? "h-full bg-destructive"
                  : usage.level === "warning"
                    ? "h-full bg-priority-high"
                    : "h-full bg-foreground/60"
              }
              style={{ width: `${Math.round(usage.ratio * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <DataroomBrowser
        eventId={eventId}
        folders={folders}
        openFolderId={openId ?? null}
        files={files.map((f) => ({
          id: f.id,
          name: f.name,
          currentVersion: f.currentVersion,
          updatedAt: f.updatedAt.toISOString(),
        }))}
        divisions={divisions.map((d) => ({ id: d.id, name: d.name }))}
      />

      {members && open ? (
        <SealedMembers
          eventId={eventId}
          folderId={open.id}
          folderName={open.name}
          members={members}
          people={people
            .filter((u) => u.role !== "external" && u.isActive)
            .map((u) => ({ id: u.id, name: u.name }))}
        />
      ) : null}
    </section>
  );
}
