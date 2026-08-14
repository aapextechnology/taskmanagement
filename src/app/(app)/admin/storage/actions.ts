"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/lib/auth/session-actor";
import { setDefaultQuota, setEventQuota } from "@/lib/dataroom/service";

const GIB = 1024 ** 3;

export interface StorageActionState {
  error?: string;
  ok?: boolean;
}

/** Admins think in GB; the service stores bytes. */
function toBytes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null; // blank = follow the installation default
  const gb = Number(trimmed);
  if (!Number.isFinite(gb) || gb <= 0) throw new Error("Enter a size in GB.");
  return Math.round(gb * GIB);
}

export async function setEventQuotaAction(
  _prev: StorageActionState,
  formData: FormData,
): Promise<StorageActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  try {
    await setEventQuota(
      actor,
      String(formData.get("eventId") ?? ""),
      toBytes(String(formData.get("limitGb") ?? "")),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath("/admin/storage");
  return { ok: true };
}

export async function setDefaultQuotaAction(
  _prev: StorageActionState,
  formData: FormData,
): Promise<StorageActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  try {
    const bytes = toBytes(String(formData.get("defaultGb") ?? ""));
    if (bytes === null) return { error: "Enter a size in GB." };
    await setDefaultQuota(actor, bytes);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath("/admin/storage");
  return { ok: true };
}
