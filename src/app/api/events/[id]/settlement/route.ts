import { NextResponse } from "next/server";
import { sessionActor } from "@/lib/auth/session-actor";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/permissions";
import { gatherSettlement } from "@/lib/reports/settlement";
import { buildSettlementPdf } from "@/lib/reports/settlement-pdf";

// Downloadable settlement report (T-101) — the financial close-out.
// Owner/Admin only, mirroring the progress report gate.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await sessionActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(actor, "dashboard.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const report = await gatherSettlement(actor, id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await buildSettlementPdf(report);
  await logActivity({
    actorId: actor.id,
    action: "settlement.download",
    entity: `event:${id}`,
    eventId: id,
  });

  const slug = report.event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = report.generatedAt.toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rvc-settlement-${slug}-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
