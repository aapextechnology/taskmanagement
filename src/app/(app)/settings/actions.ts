"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { sessionActor } from "@/lib/auth/session-actor";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

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

export interface ProfileActionState {
  error?: string;
  ok?: boolean;
}

/** Display name only. Email is deliberately not editable here: it is the
 *  login identity, and changing it safely needs verification of the new
 *  address — an admin can still correct one directly if ever needed. */
export async function updateMyProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Your name cannot be empty." };
  if (name.length > 80) return { error: "That name is too long." };

  await db
    .update(profiles)
    .set({ name, updatedAt: new Date() })
    .where(eq(profiles.id, actor.id));
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Requires the CURRENT password even though the user is signed in: an
 * unlocked laptop must not be enough to take over the account by swapping
 * its password.
 */
export async function changeMyPasswordAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const actor = await sessionActor();
  if (!actor) return { error: "Not signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) {
    return { error: "The new password needs at least 8 characters." };
  }
  if (next !== confirm) {
    return { error: "The new passwords do not match." };
  }

  const [me] = await db
    .select({ passwordHash: profiles.passwordHash })
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1);
  if (!me?.passwordHash) {
    // external accounts sign in by magic link and have no password to change
    return { error: "This account signs in without a password." };
  }
  if (!verifyPassword(current, me.passwordHash)) {
    return { error: "The current password is not right." };
  }

  await db
    .update(profiles)
    .set({ passwordHash: hashPassword(next), updatedAt: new Date() })
    .where(eq(profiles.id, actor.id));
  return { ok: true };
}
