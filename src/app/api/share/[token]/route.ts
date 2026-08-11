import { NextResponse } from "next/server";
import { safeDownloadName } from "@/lib/dataroom/paths";
import {
  logShareAccess,
  resolveShare,
} from "@/lib/dataroom/share-service";
import { readSharePass, SHARE_COOKIE } from "@/lib/dataroom/share-session";
import { openVersion, parseRange, statVersion } from "@/lib/dataroom/storage";

// Bytes for an outside visitor (EPIC-018 T-181). The link is re-resolved on
// every request — expiry, revocation and the allowlist are never cached — so
// revoking one stops the next request even mid-session.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const url = new URL(request.url);
  const wantsDownload = url.searchParams.get("download") === "1";

  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SHARE_COOKIE}=`))
    ?.slice(SHARE_COOKIE.length + 1);
  const pass = readSharePass(token, cookie ? decodeURIComponent(cookie) : undefined);

  const resolution = await resolveShare(token, {
    email: pass?.email ?? undefined,
    passcodeVerified: pass?.passcodeOk,
  });
  if (!resolution.ok) {
    // one shape for every refusal: nothing here confirms a file exists
    return NextResponse.json({ error: resolution.message }, { status: 404 });
  }
  const share = resolution.share;
  if (wantsDownload && !share.allowDownload) {
    return NextResponse.json({ error: "Downloading is turned off." }, { status: 403 });
  }

  const stored = await statVersion(share.eventId, share.fileId, share.versionNo);
  if (!stored) {
    return NextResponse.json({ error: "This document is unavailable." }, { status: 410 });
  }

  await logShareAccess(share, wantsDownload ? "download" : "view");

  const range = parseRange(request.headers.get("range"), stored.sizeBytes);
  if (range === "unsatisfiable") {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${stored.sizeBytes}` },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": share.mimeType,
    "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${safeDownloadName(share.fileName)}"`,
    "Accept-Ranges": "bytes",
    // a shared document must never sit in a shared proxy cache
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };

  if (range) {
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${stored.sizeBytes}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
    return new NextResponse(openVersion(stored, range), { status: 206, headers });
  }
  headers["Content-Length"] = String(stored.sizeBytes);
  return new NextResponse(openVersion(stored), { status: 200, headers });
}
