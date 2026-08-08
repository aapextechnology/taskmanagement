import { NextResponse } from "next/server";
import { sessionActor } from "@/lib/auth/session-actor";
import { globalSearch } from "@/lib/search/service";

// Global search endpoint (T-102) backing the ⌘K palette. Scoping happens
// inside globalSearch — this route only authenticates.
export async function GET(request: Request) {
  const actor = await sessionActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await globalSearch(actor, q);
  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
