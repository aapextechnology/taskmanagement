import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/auth/session-actor";
import { listDivisions, listUsersWithMemberships } from "@/lib/org/service";
import { can } from "@/lib/permissions";
import { AdminTabs } from "./admin-tabs";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const actor = await sessionActor();
  if (!actor || !can(actor, "org.manage")) redirect("/my-tasks");

  const [users, divisions] = await Promise.all([
    listUsersWithMemberships(),
    listDivisions(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold uppercase tracking-tight">Admin</h1>
        <Link
          href="/admin/audit"
          className="text-xs font-medium uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Audit log ↗
        </Link>
      </div>

      <AdminTabs
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          memberships: u.memberships.map((m) => ({
            divisionId: m.divisionId,
            role: m.role,
          })),
        }))}
        divisions={divisions.map((d) => ({ id: d.id, name: d.name }))}
      />
    </section>
  );
}
