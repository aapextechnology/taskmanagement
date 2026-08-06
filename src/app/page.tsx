import { ActionLink } from "@/components/action-link";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section className="flex flex-col gap-8 py-16">
        <h1 className="max-w-3xl text-5xl font-semibold uppercase leading-[1.05] tracking-tight sm:text-7xl">
          Everything
          <br />
          behind the show
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          One workspace per event. Eleven divisions, external collaborators,
          approvals, and the countdown to show day — in one place.
        </p>
        <div className="flex gap-8">
          <ActionLink href="/my-tasks">My Tasks</ActionLink>
          <ActionLink href="/events">Events</ActionLink>
        </div>
      </section>
    </AppShell>
  );
}
