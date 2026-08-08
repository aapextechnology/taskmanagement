import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { getEvent, listEventDivisions } from "@/lib/events/service";
import {
  listInvites,
  listSubmissionsForReview,
} from "@/lib/external/service";
import { can } from "@/lib/permissions";
import { InviteForm, InviteList, SubmissionReviewList } from "./guests-ui";

export const metadata: Metadata = { title: "Guests" };

// T-071/T-074: invite management + external submission review queue.
export default async function GuestsPage({
  params,
}: PageProps<"/events/[id]/guests">) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const { id } = await params;
  const event = await getEvent(actor, id);
  if (!event) notFound();

  const eventDivisionList = await listEventDivisions(actor, id);
  const invitableDivisions = eventDivisionList.filter((d) =>
    can(actor, "external.invite", { divisionId: d.id }),
  );

  const [invites, submissions] = await Promise.all([
    listInvites(actor, id),
    listSubmissionsForReview(actor, id),
  ]);
  const divisionName = new Map(eventDivisionList.map((d) => [d.id, d.name]));

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <Link
          href={`/events/${id}`}
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {event.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          External guests
        </h1>
        <p className="text-sm text-muted-foreground">
          Vendors, artist management, and partners — scoped to one division,
          magic-link access, every submission reviewed.
        </p>
      </div>

      {invitableDivisions.length > 0 ? (
        <InviteForm
          eventId={id}
          divisions={invitableDivisions.map((d) => ({ id: d.id, name: d.name }))}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Invites{invites.length > 0 ? ` · ${invites.length}` : ""}
        </h2>
        <InviteList
          eventId={id}
          invites={invites.map((r) => ({
            id: r.invite.id,
            guestName: r.guestName,
            guestEmail: r.guestEmail,
            divisionName: divisionName.get(r.invite.divisionId) ?? r.invite.divisionId,
            requestedForms: r.invite.requestedForms as string[],
            expiresAt: r.invite.expiresAt.toISOString(),
            revoked: r.invite.revokedAt !== null,
            expired: r.invite.expiresAt < new Date(),
          }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Submissions{submissions.length > 0 ? ` · ${submissions.length}` : ""}
        </h2>
        <SubmissionReviewList
          eventId={id}
          submissions={submissions.map((r) => ({
            id: r.submission.id,
            type: r.submission.type,
            status: r.submission.status,
            data: r.submission.data as Record<string, string>,
            guestName: r.guestName,
            divisionName:
              divisionName.get(r.submission.divisionId) ?? r.submission.divisionId,
            submittedAt: r.submission.submittedAt?.toISOString() ?? null,
            reviewNote: r.submission.reviewNote,
          }))}
        />
      </div>
    </section>
  );
}
