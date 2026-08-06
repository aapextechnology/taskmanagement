import { NextResponse } from "next/server";
import { sessionActor } from "@/lib/auth/session-actor";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/permissions";
import { buildEventReportPdf } from "@/lib/reports/pdf";
import { gatherEventReport } from "@/lib/reports/service";

// Downloadable event progress report (Owner request 2026-08-06).
// Owner/Admin only — the same gate as the executive dashboard.
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
  const report = await gatherEventReport(actor, id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await buildEventReportPdf(report);
  await logActivity({
    actorId: actor.id,
    action: "report.download",
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
      "Content-Disposition": `attachment; filename="rvc-report-${slug}-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
