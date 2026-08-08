import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FORM_DEFINITIONS, type FormType } from "@/lib/external/forms";
import {
  getGuestContext,
  listGuestSubmissions,
} from "@/lib/external/service";
import { GuestForm } from "./guest-form";

export const metadata: Metadata = { title: "Form" };

export default async function GuestFormPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/guest/login");
  const context = await getGuestContext(session.user.id);
  if (!context) redirect("/guest/login");

  const { type } = await params;
  const definition = FORM_DEFINITIONS[type as FormType];
  const requested = context.invite.requestedForms as FormType[];
  if (!definition || !requested.includes(type as FormType)) notFound();

  const submissions = await listGuestSubmissions(
    session.user.id,
    context.invite.id,
  );
  const existing = submissions.find((s) => s.type === type);
  const readOnly =
    existing !== undefined && ["submitted", "accepted"].includes(existing.status);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/guest"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← {context.eventName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {definition.title}
        </h1>
        <p className="text-sm text-muted-foreground">{definition.description}</p>
        {existing?.status === "changes_requested" && existing.reviewNote ? (
          <p className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Reviewer: “{existing.reviewNote}”
          </p>
        ) : null}
      </div>
      <GuestForm
        type={type as FormType}
        fields={definition.fields}
        initialData={(existing?.data as Record<string, string>) ?? {}}
        readOnly={readOnly}
        status={existing?.status}
      />
    </section>
  );
}
