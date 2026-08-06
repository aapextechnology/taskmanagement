"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignMembershipAction,
  createUserAction,
  type ActionState,
} from "./actions";

const selectClass =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createUserAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-muted-foreground">User created.</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}

export function AssignMembershipForm({
  users,
  divisions,
}: {
  users: Array<{ id: string; name: string }>;
  divisions: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    assignMembershipAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        <Label htmlFor="assign-division">Division</Label>
        <select id="assign-division" name="divisionId" className={selectClass} required>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="assign-role">Division role</Label>
        <select id="assign-role" name="role" className={selectClass} defaultValue="staff">
          <option value="staff">Staff</option>
          <option value="head">Head</option>
        </select>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-muted-foreground">Membership saved.</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Assign"}
      </Button>
    </form>
  );
}
