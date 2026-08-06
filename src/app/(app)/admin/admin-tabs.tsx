"use client";

import { useActionState, useState } from "react";
import { UserAvatar } from "@/components/task-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  assignMembershipAction,
  createUserAction,
  removeMembershipAction,
  toggleActiveAction,
  type ActionState,
} from "./actions";

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-3 text-sm outline-none";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  memberships: Array<{ divisionId: string; role: string }>;
}

export interface AdminDivision {
  id: string;
  name: string;
}

const TABS = [
  { key: "users", label: "Users" },
  { key: "create", label: "Create user" },
  { key: "assign", label: "Assign divisions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AdminTabs({
  users,
  divisions,
}: {
  users: AdminUser[];
  divisions: AdminDivision[];
}) {
  const [tab, setTab] = useState<TabKey>("users");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <UsersTable users={users} divisions={divisions} />
      ) : null}
      {tab === "create" ? <CreateUserForm divisions={divisions} /> : null}
      {tab === "assign" ? (
        <AssignForm users={users} divisions={divisions} />
      ) : null}
    </div>
  );
}

function UsersTable({
  users,
  divisions,
}: {
  users: AdminUser[];
  divisions: AdminDivision[];
}) {
  const divisionName = new Map(divisions.map((d) => [d.id, d.name]));

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Divisions</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2.5">
                  <UserAvatar name={user.name} className="size-7 text-[10px]" />
                  <span className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                </span>
              </td>
              <td className="px-4 py-3 text-xs uppercase tracking-wider">
                {user.role}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {user.memberships.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    user.memberships.map((m) => (
                      <form action={removeMembershipAction} key={m.divisionId}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          type="hidden"
                          name="divisionId"
                          value={m.divisionId}
                        />
                        <button
                          type="submit"
                          title="Remove from division"
                          className={cn(
                            "rounded-sm border px-2 py-0.5 text-xs transition-colors hover:border-destructive hover:text-destructive",
                            m.role === "head" && "font-semibold",
                          )}
                        >
                          {divisionName.get(m.divisionId) ?? m.divisionId}
                          {m.role === "head" ? " · HEAD" : ""}
                          <span className="ml-1 text-muted-foreground">×</span>
                        </button>
                      </form>
                    ))
                  )}
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
                    variant={user.isActive ? "ghost" : "destructive"}
                    size="sm"
                    type="submit"
                    title={
                      user.isActive
                        ? "Click to DEACTIVATE this account"
                        : "Click to reactivate"
                    }
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DivisionChecklist({
  divisions,
  name,
}: {
  divisions: AdminDivision[];
  name: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-md border p-3 sm:grid-cols-3">
      {divisions.map((d) => (
        <label
          key={d.id}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            name={name}
            value={d.id}
            className="size-3.5 accent-foreground"
          />
          {d.name}
        </label>
      ))}
    </div>
  );
}

function CreateUserForm({ divisions }: { divisions: AdminDivision[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createUserAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-name">Name</Label>
          <Input id="new-name" name="name" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-email">Email</Label>
          <Input id="new-email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-role">Global role</Label>
          <select id="new-role" name="role" className={selectClass} defaultValue="member">
            <option value="member">Member (internal)</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="external">External (magic link only)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Password (internal roles)</Label>
          <Input id="new-password" name="password" type="password" minLength={8} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Divisions (optional — can pick several)</Label>
        <DivisionChecklist divisions={divisions} name="divisionIds" />
        <div className="flex items-center gap-2">
          <Label htmlFor="new-divrole" className="text-xs text-muted-foreground">
            join as
          </Label>
          <select
            id="new-divrole"
            name="divisionRole"
            className={`${selectClass} h-8 text-xs`}
            defaultValue="staff"
          >
            <option value="staff">Staff</option>
            <option value="head">Head</option>
          </select>
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-muted-foreground">User created.</p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}

function AssignForm({
  users,
  divisions,
}: {
  users: AdminUser[];
  divisions: AdminDivision[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    assignMembershipAction,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="assign-user">User</Label>
          <select id="assign-user" name="userId" className={selectClass} required>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assign-role">Join as</Label>
          <select id="assign-role" name="role" className={selectClass} defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="head">Head</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Divisions — pick one or several</Label>
        <DivisionChecklist divisions={divisions} name="divisionIds" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-muted-foreground">Memberships saved.</p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Assign"}
        </Button>
      </div>
    </form>
  );
}
