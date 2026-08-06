import { eq } from "drizzle-orm";
import { db } from "@/db";
import { divisionMembers, profiles } from "@/db/schema";
import type { Actor } from "./index";

// Build the Actor for permission checks. Memberships are ALWAYS read fresh
// from the database — the JWT only carries id + global role, so a demoted
// user loses access on their next request, not at token expiry.
export async function getActor(userId: string): Promise<Actor | null> {
  const [user] = await db
    .select({ id: profiles.id, role: profiles.role, isActive: profiles.isActive })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!user || !user.isActive) return null;

  const memberships = await db
    .select({
      divisionId: divisionMembers.divisionId,
      role: divisionMembers.role,
    })
    .from(divisionMembers)
    .where(eq(divisionMembers.userId, userId));

  return { id: user.id, role: user.role, memberships };
}
