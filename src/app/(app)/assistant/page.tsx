import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { auth } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai/openai";
import { listActiveEvents } from "@/lib/events/service";
import { can } from "@/lib/permissions";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "AI Assistant" };

// EPIC-014 T-140: predictive chat over the org's live data — leadership
// only (owner / admin / division heads).
export default async function AssistantPage() {
  const session = await auth();
  const actor = await sessionActor();
  if (!actor) redirect("/login");
  if (!can(actor, "ai.assistant")) redirect("/my-tasks");

  const events = await listActiveEvents(actor);

  return (
    <section className="flex min-h-[calc(100svh-8rem)] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about any event or the whole portfolio — predictions come with
          reasons, grounded in your live data.
        </p>
      </div>
      <AssistantChat
        userName={session?.user?.name ?? "You"}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
        configured={aiConfigured()}
      />
    </section>
  );
}
