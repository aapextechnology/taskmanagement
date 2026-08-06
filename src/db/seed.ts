import { inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { DIVISIONS } from "@/lib/org/divisions";
import { db } from "./index";
import { appSettings, divisionMembers, divisions, profiles } from "./schema";

// Demo credentials (DEV ONLY): every internal user signs in with this password.
const DEMO_PASSWORD = "backstage123";

const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "external";
  membership?: { divisionId: string; role: "head" | "staff" };
}> = [
  { email: "owner@rawvision.demo", name: "Rama Wijaya", role: "owner" },
  { email: "admin@rawvision.demo", name: "Sari Dewi", role: "admin" },
  { email: "head.production@rawvision.demo", name: "Bimo Prasetyo", role: "member", membership: { divisionId: "production", role: "head" } },
  { email: "staff.production@rawvision.demo", name: "Tono Hartawan", role: "member", membership: { divisionId: "production", role: "staff" } },
  { email: "head.marketing@rawvision.demo", name: "Maya Anggraini", role: "member", membership: { divisionId: "marketing-communications", role: "head" } },
  { email: "staff.marketing@rawvision.demo", name: "Dina Puspita", role: "member", membership: { divisionId: "marketing-communications", role: "staff" } },
  { email: "head.finance@rawvision.demo", name: "Agus Santoso", role: "member", membership: { divisionId: "finance", role: "head" } },
  { email: "staff.finance@rawvision.demo", name: "Rina Kusuma", role: "member", membership: { divisionId: "finance", role: "staff" } },
  // magic-link only — no password (EPIC-007)
  { email: "vendor@soundsupply.example", name: "Sound Supply Co.", role: "external" },
];

// Idempotent seed (T-003 skeleton). Each epic extends `steps` with its own
// fixtures: divisions + demo users (T-010/T-015), demo event (T-020)…
const steps: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "11 RVC divisions",
    run: async () => {
      await db
        .insert(divisions)
        .values(DIVISIONS.map((d, index) => ({ ...d, sortOrder: index })))
        .onConflictDoNothing();
    },
  },
  {
    name: "demo users + division memberships (dev)",
    run: async () => {
      await db
        .insert(profiles)
        .values(
          DEMO_USERS.map((u) => ({
            email: u.email,
            name: u.name,
            role: u.role,
            passwordHash:
              u.role === "external" ? null : hashPassword(DEMO_PASSWORD),
          })),
        )
        .onConflictDoNothing();

      const emails = DEMO_USERS.filter((u) => u.membership).map(
        (u) => u.email,
      );
      const rows = await db
        .select({ id: profiles.id, email: profiles.email })
        .from(profiles)
        .where(inArray(profiles.email, emails));
      const idByEmail = new Map(rows.map((r) => [r.email, r.id]));

      const memberships = DEMO_USERS.flatMap((u) => {
        const userId = idByEmail.get(u.email);
        return u.membership && userId
          ? [{ ...u.membership, userId }]
          : [];
      });
      if (memberships.length > 0) {
        await db
          .insert(divisionMembers)
          .values(memberships)
          .onConflictDoNothing();
      }
    },
  },
  {
    name: "default org settings",
    run: async () => {
      await db
        .insert(appSettings)
        .values([
          { key: "currency", value: "IDR" },
          // Proposed defaults — Owner confirms real numbers (PRD open question).
          { key: "approval_threshold_a", value: 10_000_000 },
          { key: "approval_threshold_b", value: 100_000_000 },
        ])
        .onConflictDoNothing();
    },
  },
];

async function main() {
  for (const step of steps) {
    await step.run();
    console.log(`[seed] ${step.name} ✓`);
  }
  console.log("[seed] done");
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
