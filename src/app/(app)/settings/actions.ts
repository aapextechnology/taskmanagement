"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { sessionActor } from "@/lib/auth/session-actor";

// Self-service notification preferences (T-100). A user can only ever
// mutate their OWN row — the id comes from the session, never the form.
export async function updateMyPreferencesAction(formData: FormData) {
  const actor = await sessionActor();
  if (!actor) return;

  const phone = String(formData.get("phone") ?? "").trim();
  await db
    .update(profiles)
    .set({
      emailNotifications: formData.get("emailNotifications") === "on",
      whatsappNotifications: formData.get("whatsappNotifications") === "on",
      dailyDigest: formData.get("dailyDigest") === "on",
      weeklyDigest: formData.get("weeklyDigest") === "on",
      phone: phone || null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, actor.id));

  revalidatePath("/settings");
}
