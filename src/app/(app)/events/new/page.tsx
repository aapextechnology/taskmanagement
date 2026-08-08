import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";
import { listTemplates } from "@/lib/templates/service";
import { NewEventForm } from "./new-event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  const actor = await sessionActor();
  if (!actor || !can(actor, "event.create")) redirect("/events");

  const templates = await listTemplates();

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        New event
      </h1>
      <NewEventForm
        templates={templates.map(({ template, itemCount }) => ({
          id: template.id,
          name: template.name,
          itemCount,
        }))}
      />
    </section>
  );
}
