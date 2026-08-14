"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import {
  listTesseraEvents,
  saveTesseraCredentials,
  syncTesseraSales,
} from "@/lib/tessera/client";

export interface TesseraActionState {
  error?: string;
  ok?: boolean;
  /** result of a connection test */
  eventCount?: number;
  eventNames?: string[];
}

export async function saveTesseraAction(
  _prev: TesseraActionState,
  formData: FormData,
): Promise<TesseraActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  try {
    await saveTesseraCredentials(actor, {
      token: String(formData.get("token") ?? ""),
      orgId: String(formData.get("orgId") ?? ""),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function testTesseraAction(
  _prev: TesseraActionState,
  _formData: FormData,
): Promise<TesseraActionState> {
  void _prev;
  void _formData; // signature fixed by useActionState; neither carries input
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  try {
    const rows = await listTesseraEvents(actor);
    revalidatePath("/admin");
    return {
      ok: true,
      eventCount: rows.length,
      eventNames: rows.slice(0, 5).map((r) => r.name),
    };
  } catch (error) {
    revalidatePath("/admin");
    return {
      error: error instanceof Error ? error.message : "Connection failed.",
    };
  }
}

/** Manual "sync now", so nobody waits an hour to see whether it works. */
export async function syncTesseraNowAction(
  _prev: TesseraActionState,
  _formData: FormData,
): Promise<TesseraActionState> {
  void _prev;
  void _formData;
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  const result = await syncTesseraSales();
  revalidatePath("/admin");
  if (result.tokenExpired) return { error: "The token has expired — paste a fresh one." };
  return { ok: true, eventCount: result.synced };
}
