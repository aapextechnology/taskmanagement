import { NextResponse } from "next/server";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";
import { saveImageUpload } from "@/lib/uploads";

// Image upload for the page editor (Owner 2026-08-07). Files land under the
// same auth-gated /api/files tree the rest of the app uses.
export async function POST(request: Request) {
  const actor = await sessionActor();
  if (!actor || !can(actor, "event.view") || actor.role === "external") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  try {
    const path = await saveImageUpload(file, "pages");
    return NextResponse.json({ url: `/api/files/${path}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
