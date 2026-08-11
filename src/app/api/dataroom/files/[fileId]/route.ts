import { NextResponse } from "next/server";
import { sessionActor } from "@/lib/auth/session-actor";
import { openForDownload } from "@/lib/dataroom/service";
import { safeDownloadName } from "@/lib/dataroom/paths";
import { openVersion, parseRange, statVersion } from "@/lib/dataroom/storage";
import { PermissionError } from "@/lib/permissions";

// Gated download (EPIC-017 T-172). Every read passes through here, which is
// why the access log cannot be bypassed — there is no other route to the
// bytes. Responses stream; nothing is read into memory.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const actor = await sessionActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileId } = await params;
  const url = new URL(request.url);
  const versionParam = url.searchParams.get("v");
  const versionNo = versionParam ? Number(versionParam) : undefined;
  const inline = url.searchParams.get("inline") === "1";

  let opened;
  try {
    // this also writes the audit entry — resolving and logging are one step
    // on purpose, so a download can never happen unrecorded
    opened = await openForDownload(actor, fileId, versionNo);
  } catch (error) {
    if (error instanceof PermissionError) {
      // 404, not 403: telling someone a file exists but is closed to them is
      // itself a disclosure
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    throw error;
  }
  if (!opened) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const stored = await statVersion(
    opened.file.eventId,
    opened.file.id,
    opened.version.versionNo,
  );
  if (!stored) {
    // the index knows a file the disk does not — say so honestly
    return NextResponse.json(
      { error: "This file is missing from storage. Ask an admin to check." },
      { status: 410 },
    );
  }

  const disposition = `${inline ? "inline" : "attachment"}; filename="${safeDownloadName(opened.file.name)}"`;
  const range = parseRange(request.headers.get("range"), stored.sizeBytes);

  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${stored.sizeBytes}` },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": opened.version.mimeType,
    "Content-Disposition": disposition,
    // lets a PDF or video be scrubbed instead of downloaded whole
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };

  if (range) {
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${stored.sizeBytes}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
    return new NextResponse(openVersion(stored, range), { status: 206, headers });
  }

  headers["Content-Length"] = String(stored.sizeBytes);
  return new NextResponse(openVersion(stored), { status: 200, headers });
}
