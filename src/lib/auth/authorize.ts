import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { verifyPassword } from "./password";

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "external";
}

// Credentials check for Auth.js `authorize`. Returns null on ANY failure —
// same result for unknown email vs wrong password (no user enumeration).
// External guests have no passwordHash and can never sign in here (magic
// link only, EPIC-007).
export async function authorizeUser(
  email: unknown,
  password: unknown,
): Promise<AuthorizedUser | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;

  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.isActive || !user.passwordHash) return null;
  if (user.role === "external") return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
