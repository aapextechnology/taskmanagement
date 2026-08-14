import { sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { DIVISIONS } from "@/lib/org/divisions";
import { normalizeMsisdn } from "@/lib/whatsapp/normalize";
import { db } from "./index";
import { divisions, profiles } from "./schema";

// Bootstrap seed (Owner 2026-08-12): ONE administrator and the division
// list — nothing else. The old demo seed (14 users, events, tasks, budgets)
// is gone; an installation starts empty and fills with real work.
//
// The admin's identity comes from env, with deliberately generic defaults.
// This file is committed to a public repository, so a real email or phone
// number in it would be published — the real values live in the
// installation's own .env:
//
//   SEED_ADMIN_EMAIL     (default admin@example.com)
//   SEED_ADMIN_NAME      (default "Super Admin")
//   SEED_ADMIN_PASSWORD  (default "changeme123" — change it after first login)
//   SEED_ADMIN_PHONE     (optional; enables WhatsApp notifications when set)
//
// Guarded, not idempotent-by-overwrite: if ANY user exists the seeder does
// nothing, so re-running it against a live installation can never touch real
// accounts or reset a password.
async function seed() {
  await db
    .insert(divisions)
    .values(DIVISIONS.map((d) => ({ id: d.id, name: d.name })))
    .onConflictDoNothing();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles);
  if (count > 0) {
    console.log(`[seed] ${count} user(s) already exist — nothing to do.`);
    return;
  }

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com")
    .trim()
    .toLowerCase();
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Super Admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";
  const rawPhone = process.env.SEED_ADMIN_PHONE?.trim() || "";
  const phone = rawPhone ? normalizeMsisdn(rawPhone) : null;
  if (rawPhone && !phone) {
    throw new Error(`SEED_ADMIN_PHONE is not a usable number: ${rawPhone}`);
  }

  await db.insert(profiles).values({
    email,
    name,
    role: "owner",
    passwordHash: hashPassword(password),
    phone,
    // a number is only worth having if it is used
    whatsappNotifications: Boolean(phone),
    isActive: true,
  });

  console.log(`[seed] created ${name} <${email}>${phone ? ` (WA ${phone})` : ""}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log("[seed] WARNING: default password in use — change it after first login.");
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exit(1);
  });
