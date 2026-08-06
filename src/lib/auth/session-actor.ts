import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/permissions";
import { getActor } from "@/lib/permissions/actor";

// Session → Actor in one step, for pages and server actions.
export async function sessionActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getActor(session.user.id);
}
