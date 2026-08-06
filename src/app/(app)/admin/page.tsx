import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { listDivisions, listUsersWithMemberships } from "@/lib/org/service";
import { can } from "@/lib/permissions";
import { getActor } from "@/lib/permissions/actor";
import {
  removeMembershipAction,
  toggleActiveAction,
} from "./actions";
import { AssignMembershipForm, CreateUserForm } from "./forms";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await auth();
  const actor = session?.user?.id ? await getActor(session.user.id) : null;
  if (!actor || !can(actor, "org.manage")) redirect("/my-tasks");

  const [users, divisions] = await Promise.all([
    listUsersWithMemberships(),
    listDivisions(),
  ]);
  const divisionName = new Map(divisions.map((d) => [d.id, d.name]));

  return (
    <section className="flex flex-col gap-10">
      <h1 className="text-3xl font-semibold uppercase tracking-tight">Admin</h1>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Divisions</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3 uppercase">{user.role}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {user.memberships.map((m) => (
                      <form action={removeMembershipAction} key={m.divisionId}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          type="hidden"
                          name="divisionId"
                          value={m.divisionId}
                        />
                        <button
                          type="submit"
                          title="Remove membership"
                          className="rounded-sm border px-2 py-0.5 text-xs hover:bg-accent"
                        >
                          {divisionName.get(m.divisionId) ?? m.divisionId}
                          {m.role === "head" ? " · HEAD" : ""} ×
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleActiveAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={String(!user.isActive)}
                    />
                    <Button
                      variant={user.isActive ? "ghost" : "outline"}
                      size="sm"
                      type="submit"
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Button>
                  </form>
                </td>
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-tight">
            Create user
          </h2>
          <CreateUserForm />
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-tight">
            Assign division
          </h2>
          <AssignMembershipForm
            users={users.map((u) => ({ id: u.id, name: u.name }))}
            divisions={divisions.map((d) => ({ id: d.id, name: d.name }))}
          />
        </div>
      </div>
    </section>
  );
}
