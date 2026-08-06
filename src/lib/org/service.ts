import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { divisionMembers, divisions, profiles } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth/password";
import { assertCan, type Actor, type DivisionRole } from "@/lib/permissions";

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
  },
) {
  assertCan(actor, "org.manage");
  const email = input.email.toLowerCase().trim();
  const [user] = await db
    .insert(profiles)
    .values({
      email,
      name: input.name.trim(),
      role: input.role,
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
