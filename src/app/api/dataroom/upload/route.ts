import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/dataroom/service";
import { sessionActor } from "@/lib/auth/session-actor";
import { PermissionError } from "@/lib/permissions";

// Dataroom upload (EPIC-017 T-172).
//
// A raw PUT with the file as the body, not multipart: multipart is buffered
// before the handler sees it, so a 2 GB upload would be held in memory before
// any quota check could run. Here the metadata rides in the query string and
// the body is piped straight to disk while its bytes are counted.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// large uploads over a slow line need more than the default
export const maxDuration = 600;

export async function PUT(request: Request) {
  const actor = await sessionActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId") ?? "";
  const name = url.searchParams.get("name") ?? "";
  const replaceFileId = url.searchParams.get("replaceFileId") ?? undefined;

  if (!folderId || !name) {
    return NextResponse.json({ error: "Missing folder or file name." }, { status: 400 });
  }
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (!request.body) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }

  try {
    const result = await uploadFile(actor, {
      folderId,
      name,
      declaredSize,
      mimeType: request.headers.get("x-file-type") ?? undefined,
      body: request.body,
      replaceFileId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    // quota and disk-floor refusals are expected outcomes, not faults: the
    // message already names the numbers, so it goes straight to the user
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
