import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { buildAssistantContext } from "@/lib/ai/context";
import { aiConfigured, streamChat, type ChatMessage } from "@/lib/ai/openai";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";

// AI assistant chat endpoint (EPIC-014 T-140). Streams plain text. The
// context injected into the prompt is permission-scoped per actor in
// buildAssistantContext — leadership gate here, data scoping there.

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are the RVC Backstage assistant — the in-house analyst for Raw Vision Collective, an Indonesian concert promoter. You answer questions about their live event/task data and assess whether events are on course.

You receive a JSON snapshot of the data the CURRENT USER is allowed to see (their permission scope — never speculate about data outside it). All amounts are IDR. Dates/times are WIB (Asia/Jakarta).

When asked whether an event will run smoothly (or for any risk assessment):
1. Give a clear verdict first: ON COURSE / AT RISK / CRITICAL, with a confidence level.
2. Then the reasons, ranked by severity, grounded in the snapshot: time pressure (daysToShow vs open/overdue work and remaining phases), dependency pressure (bottlenecks list — tasks many others wait on), workload concentration (workloadTop — one person carrying too many open tasks), unresolved external waits (permits, vendors), budget burn (committed+paid vs planned), ticket pace (sold vs capacity given daysToShow), and auto-escalated urgent tasks.
3. Recommend the 2–3 highest-leverage actions, each tied to a reason.
4. When useful, benchmark against typical industry practice for comparable concerts (e.g. permits secured 60–90 days out, ticket on-sale 6–12 weeks before show, production advance locked by show-week). Present these as general industry heuristics from your own knowledge — NEVER invent specific named events, figures, or sources.

Style: answer in the user's language (Indonesian or English). Be direct and concrete — name tasks, people, and numbers from the snapshot. Use short paragraphs and lists, no filler. If the snapshot lacks the data to answer, say exactly what is missing instead of guessing.`;

interface ChatRequestBody {
  messages?: Array<{ role?: string; content?: string }>;
  eventId?: string;
}

export async function POST(request: Request) {
  const actor = await sessionActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(actor, "ai.assistant")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "AI assistant is not configured (OPENAI_API_KEY is empty)." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
  const history: ChatMessage[] = (body.messages ?? [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    // last 12 turns is plenty of memory and caps prompt cost
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8_000) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "No user message." }, { status: 400 });
  }

  const eventId =
    typeof body.eventId === "string" && body.eventId ? body.eventId : undefined;
  const context = await buildAssistantContext(actor, eventId);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `Data snapshot (permission-scoped to this user):\n${JSON.stringify(context)}`,
    },
    ...history,
  ];

  await logActivity({
    actorId: actor.id,
    action: "ai.chat",
    entity: `ai:${eventId ?? "portfolio"}`,
    detail: {
      question: history[history.length - 1].content.slice(0, 200),
    },
    eventId,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamChat(messages)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `\n\n[error] ${error instanceof Error ? error.message : "AI request failed."}`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // defeat proxy buffering so tokens render as they arrive
      "X-Accel-Buffering": "no",
    },
  });
}
