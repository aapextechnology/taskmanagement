import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";

// WhatsApp gateway control surface (EPIC-015). Org-admin only — linking a
// device sends messages on the organisation's behalf.
//
// GET  -> current status + pairing QR (polled by the admin UI)
// POST -> { action: "connect" | "disconnect" | "test", to?: string }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate() {
  const actor = await sessionActor();
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!can(actor, "org.manage")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}

export async function GET() {
  const { actor, error } = await gate();
  if (error) return error;
  void actor;
  const { getStatus } = await import("@/lib/whatsapp/session");
  return NextResponse.json(getStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const { actor, error } = await gate();
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    to?: string;
  };
  const { connect, disconnect, getStatus, sendText, isConnected } = await import(
    "@/lib/whatsapp/session"
  );

  switch (body.action) {
    case "connect": {
      // returns immediately; the UI polls GET for the QR
      void connect().catch(() => {});
      await logActivity({
        actorId: actor!.id,
        action: "whatsapp.connect",
        entity: "org:whatsapp",
      });
      return NextResponse.json({ ok: true, ...getStatus() });
    }
    case "disconnect": {
      await disconnect();
      await logActivity({
        actorId: actor!.id,
        action: "whatsapp.disconnect",
        entity: "org:whatsapp",
      });
      return NextResponse.json({ ok: true, ...getStatus() });
    }
    case "test": {
      if (!isConnected()) {
        return NextResponse.json(
          { error: "Gateway is not connected." },
          { status: 409 },
        );
      }
      const to = String(body.to ?? "").trim();
      if (!to) {
        return NextResponse.json({ error: "Enter a number." }, { status: 400 });
      }
      const sent = await sendText(
        to,
        "Test message from Backstage — your WhatsApp gateway is working.",
      );
      await logActivity({
        actorId: actor!.id,
        action: "whatsapp.test",
        entity: "org:whatsapp",
        detail: { delivered: sent },
      });
      return sent
        ? NextResponse.json({ ok: true })
        : NextResponse.json(
            { error: "Could not send — check the number format." },
            { status: 400 },
          );
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
