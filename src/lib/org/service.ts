import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisionMembers, divisions, profiles } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth/password";
import { assertCan, type Actor, type DivisionRole } from "@/lib/permissions";
import { normalizeMsisdn } from "@/lib/whatsapp/normalize";

// Org administration service (T-013). Every function takes the acting user
// and enforces capability + audit logging here — UI layers never touch the
// tables directly.

export async function listDivisions() {
  return db.select().from(divisions).orderBy(asc(divisions.sortOrder));
}

export async function listUsersWithMemberships() {
  const users = await db
    .select()
    .from(profiles)
    .orderBy(asc(profiles.createdAt));
  const memberships = await db.select().from(divisionMembers);
  const byUser = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const list = byUser.get(m.userId) ?? [];
    list.push(m);
    byUser.set(m.userId, list);
  }
  return users.map((u) => ({
    ...u,
    memberships: byUser.get(u.id) ?? [],
  }));
}

export async function createUser(
  actor: Actor,
  input: {
    email: string;
    name: string;
    role: "owner" | "admin" | "member" | "external";
    password?: string;
    /** raw as typed; normalised to an msisdn before it is stored */
    phone?: string;
  },
) {
  assertCan(actor, "org.manage");
  const email = input.email.toLowerCase().trim();
  const phone = input.phone?.trim() ? normalizeMsisdn(input.phone) : null;
  if (input.phone?.trim() && !phone) {
    throw new Error("That phone number doesn't look valid.");
  }
  const [user] = await db
    .insert(profiles)
    .values({
      email,
      name: input.name.trim(),
      role: input.role,
      phone,
      // a number is only worth storing if it will be used — setting one in
      // Admin turns the channel on, otherwise nothing would ever send
      whatsappNotifications: Boolean(phone),
      passwordHash:
        input.role !== "external" && input.password
          ? hashPassword(input.password)
          : null,
    })
    .returning();
  await logActivity({
    actorId: actor.id,
    action: "user.create",
    entity: `profile:${user.id}`,
    detail: { email, role: input.role },
  });
  return user;
}

/**
 * Admin-side contact details (EPIC-016 follow-up). Until this existed a
 * number could only be set by each person in their own Settings, so the
 * WhatsApp gateway had no recipients at all.
 *
 * Clearing the number also switches the channel off: keeping the flag on
 * with nowhere to send is a silent no-op that looks like it works.
 */
export async function setUserContact(
  actor: Actor,
  userId: string,
  input: { phone: string; whatsappNotifications: boolean },
) {
  assertCan(actor, "org.manage");
  const raw = input.phone.trim();
  const phone = raw ? normalizeMsisdn(raw) : null;
  if (raw && !phone) {
    throw new Error(
      "That phone number doesn't look valid. Use 08…, 62… or +62… .",
    );
  }
  await db
    .update(profiles)
    .set({
      phone,
      whatsappNotifications: phone ? input.whatsappNotifications : false,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));
  await logActivity({
    actorId: actor.id,
    action: "user.contact_update",
    entity: `profile:${userId}`,
    // the number itself stays out of the audit detail
    detail: { hasPhone: Boolean(phone), whatsapp: Boolean(phone) && input.whatsappNotifications },
  });
}

export async function setUserActive(
  actor: Actor,
  userId: string,
  isActive: boolean,
) {
  assertCan(actor, "org.manage");
  await db
    .update(profiles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
  await logActivity({
    actorId: actor.id,
    action: isActive ? "user.activate" : "user.deactivate",
    entity: `profile:${userId}`,
  });
}

export async function assignMembership(
  actor: Actor,
  userId: string,
  divisionId: string,
  role: DivisionRole,
) {
  assertCan(actor, "org.manage");
  await db
    .insert(divisionMembers)
    .values({ userId, divisionId, role })
    .onConflictDoUpdate({
      target: [divisionMembers.divisionId, divisionMembers.userId],
      set: { role },
    });
  await logActivity({
    actorId: actor.id,
    action: "membership.assign",
    entity: `profile:${userId}`,
    detail: { divisionId, role },
  });
}

export async function removeMembership(
  actor: Actor,
  userId: string,
  divisionId: string,
) {
  assertCan(actor, "org.manage");
  await db
    .delete(divisionMembers)
    .where(
      and(
        eq(divisionMembers.userId, userId),
        eq(divisionMembers.divisionId, divisionId),
      ),
    );
  await logActivity({
    actorId: actor.id,
    action: "membership.remove",
    entity: `profile:${userId}`,
    detail: { divisionId },
  });
}
