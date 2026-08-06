import { inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { recomputeEventHealth } from "@/lib/events/service";
import { DIVISIONS } from "@/lib/org/divisions";
import { db } from "./index";
import {
  appSettings,
  divisionMembers,
  divisions,
  eventDivisions,
  events,
  profiles,
  taskAssignees,
  taskDependencies,
  tasks,
} from "./schema";

// fixed id so the demo event seeds idempotently
const DEMO_EVENT_ID = "00000000-0000-4000-8000-00000000e001";

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
    name: "demo tasks (dev)",
    run: async () => {
      const now = Date.now();
      await db
        .insert(tasks)
        .values(
          DEMO_TASKS.map((t) => ({
            id: t.id,
            eventId: DEMO_EVENT_ID,
            divisionId: t.divisionId,
            title: t.title,
            status: "todo" as const,
            dueDate:
              t.dueOffsetHours === null
                ? null
                : new Date(now + t.dueOffsetHours * 3600_000),
          })),
        )
        .onConflictDoNothing();

      const emails = DEMO_TASKS.flatMap((t) =>
        t.assigneeEmail ? [t.assigneeEmail] : [],
      );
      const users = await db
        .select({ id: profiles.id, email: profiles.email })
        .from(profiles)
        .where(inArray(profiles.email, emails));
      const idByEmail = new Map(users.map((u) => [u.email, u.id]));

      for (const t of DEMO_TASKS) {
        const userId = t.assigneeEmail
          ? idByEmail.get(t.assigneeEmail)
          : undefined;
        if (userId) {
          await db
            .insert(taskAssignees)
            .values({ taskId: t.id, userId })
            .onConflictDoNothing();
        }
        if (t.dependsOn) {
          await db
            .insert(taskDependencies)
            .values({ taskId: t.id, dependsOnTaskId: t.dependsOn })
            .onConflictDoNothing();
        }
      }
      await recomputeEventHealth(DEMO_EVENT_ID);
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
          // health rule tuning (PRD Appendix B)
          { key: "health_overdue_critical", value: 5 },
          { key: "health_committed_ratio_at_risk", value: 0.9 },
        ])
        .onConflictDoNothing();
    },
  },
  {
    name: "demo event (dev)",
    run: async () => {
      const showDate = new Date();
      showDate.setDate(showDate.getDate() + 90); // ~3 months out
      await db
        .insert(events)
        .values({
          id: DEMO_EVENT_ID,
          name: "YE Live in Jakarta",
          artists: "YE · Special Guests",
          venue: "Jakarta International Stadium",
          showDate,
          capacity: 60_000,
          phase: "planning",
        })
        .onConflictDoNothing();
      const allDivisions = await db.select({ id: divisions.id }).from(divisions);
      await db
        .insert(eventDivisions)
        .values(
          allDivisions.map((d) => ({
            eventId: DEMO_EVENT_ID,
            divisionId: d.id,
          })),
        )
        .onConflictDoNothing();
    },
  },
];

const DEMO_TASKS: Array<{
  id: string;
  divisionId: string;
  title: string;
  dueOffsetHours: number | null;
  assigneeEmail?: string;
  dependsOn?: string;
}> = [
  {
    id: "00000000-0000-4000-8000-00000000a001",
    divisionId: "production",
    title: "Confirm stage rigging vendor",
    dueOffsetHours: -48, // overdue → demo event turns AT RISK
    assigneeEmail: "staff.production@rawvision.demo",
  },
  {
    id: "00000000-0000-4000-8000-00000000a002",
    divisionId: "production",
    title: "Draft technical rider checklist",
    dueOffsetHours: 6,
    assigneeEmail: "head.production@rawvision.demo",
  },
  {
    id: "00000000-0000-4000-8000-00000000a003",
    divisionId: "production",
    title: "Site build plan v1",
    dueOffsetHours: 14 * 24,
    assigneeEmail: "staff.production@rawvision.demo",
    dependsOn: "00000000-0000-4000-8000-00000000a001",
  },
  {
    id: "00000000-0000-4000-8000-00000000a004",
    divisionId: "marketing-communications",
    title: "Announce lineup — phase 1 assets",
    dueOffsetHours: 7 * 24,
    assigneeEmail: "staff.marketing@rawvision.demo",
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
