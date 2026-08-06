"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  assignMembership,
  createUser,
  removeMembership,
  setUserActive,
} from "@/lib/org/service";
import { getActor } from "@/lib/permissions/actor";
import { PermissionError } from "@/lib/permissions";

// Server actions are public endpoints: each one rebuilds the actor from the
// session and lets the service layer enforce capabilities.
async function requireActor() {
  const session = await auth();
  if (!session?.user?.id) throw new PermissionError("org.manage");
  const actor = await getActor(session.user.id);
  if (!actor) throw new PermissionError("org.manage");
  return actor;
}

export interface ActionState {
  error?: string;
  ok?: boolean;
}

function asError(error: unknown): ActionState {
  if (error instanceof PermissionError) return { error: "Not allowed." };
  if (
    error instanceof Error &&
    /duplicate key|unique/i.test(error.message)
  ) {
    return { error: "A user with that email already exists." };
  }
  throw error;
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    await createUser(actor, {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      role: String(formData.get("role")) as
        | "owner"
        | "admin"
        | "member"
        | "external",
      password: String(formData.get("password") ?? "") || undefined,
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return asError(error);
  }
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await setUserActive(
    actor,
    String(formData.get("userId")),
    formData.get("isActive") === "true",
  );
  revalidatePath("/admin");
}

export async function assignMembershipAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireActor();
    await assignMembership(
      actor,
      String(formData.get("userId")),
      String(formData.get("divisionId")),
      String(formData.get("role")) as "head" | "staff",
    );
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return asError(error);
  }
}

export async function removeMembershipAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await removeMembership(
    actor,
    String(formData.get("userId")),
    String(formData.get("divisionId")),
  );
  revalidatePath("/admin");
}
