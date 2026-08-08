import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEvent, listEventDivisions } from "@/lib/events/service";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  DOCUMENT_CATEGORIES,
  documentDownloadHref,
  filterDocuments,
  type DocumentCategory,
} from "@/lib/documents/logic";
import { listEventDocuments } from "@/lib/documents/service";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, UploadDocumentForm } from "./documents-ui";

export const metadata: Metadata = { title: "Documents" };

const dt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function isDocumentCategory(value: string | undefined): value is DocumentCategory {
  return (
    value !== undefined &&
    (DOCUMENT_CATEGORIES as readonly string[]).includes(value)
  );
}

// EPIC-008 T-082: the document library — contracts, permits, riders, stage
// plots. One upload per row, scoped to one division; visibility + downloads
// both go through document.view (src/lib/permissions).
export default async function DocumentsPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/documents">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  const sp = await searchParams;
  const rawCategory = typeof sp.category === "string" ? sp.category : undefined;
  const category = isDocumentCategory(rawCategory) ? rawCategory : undefined;

  const eventDivisionList = await listEventDivisions(actor, id);
  const manageableDivisions = eventDivisionList.filter((d) =>
    can(actor, "document.manage", { divisionId: d.id }),
  );
  const divisionName = new Map(eventDivisionList.map((d) => [d.id, d.name]));

  const allDocs = await listEventDocuments(actor, id);
  const docs = filterDocuments(allDocs, { category });

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/events/${id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {event.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Contracts, permits, riders, and stage plots — scoped to one
          division, one download link at a time.
        </p>
      </div>

      {manageableDivisions.length > 0 ? (
        <UploadDocumentForm
          eventId={id}
          divisions={manageableDivisions.map((d) => ({ id: d.id, name: d.name }))}
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Link
          href={`/events/${id}/documents`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-all",
            !category
              ? "border-foreground bg-foreground font-medium text-background"
              : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
          )}
        >
          All
        </Link>
        {DOCUMENT_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/events/${id}/documents?category=${c}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-all",
              category === c
                ? "border-foreground bg-foreground font-medium text-background"
                : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
      </div>

      {docs.length === 0 ? (
        <p className="rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground">
          {category ? "No documents in this category yet." : "No documents uploaded yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border bg-card elev">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{doc.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {doc.fileName}
                </span>
              </div>
              <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                {CATEGORY_LABEL[doc.category]}
              </span>
              <span className="text-xs text-muted-foreground">
                {divisionName.get(doc.divisionId) ?? doc.divisionId}
              </span>
              <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                {dt.format(doc.createdAt)} WIB
              </span>
              <a
                href={documentDownloadHref(doc)}
                className="text-xs font-medium underline-offset-4 hover:underline"
              >
                Download ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
