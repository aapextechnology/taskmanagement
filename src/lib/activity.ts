import { db } from "@/db";
import { activityLog } from "@/db/schema";

interface LogInput {
  actorId: string | null;
  action: string;
  entity: string;
  detail?: Record<string, unknown>;
  eventId?: string;
}

// Fire-and-record audit write (T-014). Callers await it inside the same
// mutation flow so a logged action implies the mutation happened. Never put
// secrets or password hashes in `detail`.
export async function logActivity(input: LogInput): Promise<void> {
  await db.insert(activityLog).values({
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    detail: input.detail ?? null,
    eventId: input.eventId ?? null,
  });
}
