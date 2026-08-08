import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sessionActor } from "@/lib/auth/session-actor";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";

// Auth-gated file serving (posters now, attachments in EPIC-003). Files live
// under UPLOADS_DIR and are NEVER served by nginx directly — every download
// passes this session check. Paths under documents/ get an EXTRA
// division-scoped check (EPIC-008 T-082) via document.view.

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;
  const uploadsRoot = path.resolve(env.UPLOADS_DIR);
  const target = path.resolve(uploadsRoot, ...segments);

  // path traversal guard: resolved target must stay inside UPLOADS_DIR
  if (!target.startsWith(uploadsRoot + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relativePath = path.relative(uploadsRoot, target).split(path.sep).join("/");
  if (relativePath.startsWith("documents/")) {
    const [row] = await db
      .select({ divisionId: documents.divisionId })
      .from(documents)
      .where(eq(documents.filePath, relativePath))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const actor = await sessionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!can(actor, "document.view", { divisionId: row.divisionId })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const contentType =
    CONTENT_TYPES[path.extname(target).toLowerCase()] ??
    "application/octet-stream";
  const stream = Readable.toWeb(
    createReadStream(target),
  ) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
