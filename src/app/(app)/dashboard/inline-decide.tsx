"use client";

import { useActionState, useRef, useState } from "react";
import {
  decideAction,
  type ApprovalActionState,
} from "@/app/(app)/approvals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/lib/use-action-toast";

// One-click approve / reject from the dashboard queue — SAME server action
// as the approvals page (no parallel decision path).
export function InlineDecide({ approvalId }: { approvalId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [state, formAction, pending] = useActionState<
    ApprovalActionState,
    FormData
  >(decideAction, {});
  const decisionRef = useRef("Decision recorded");
  useActionToast(pending, state.error, decisionRef);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="approvalId" value={approvalId} />
      {rejecting ? (
        <>
          <Input
            name="comment"
            required
            placeholder="Reason…"
            className="h-8 w-40 text-xs"
            autoFocus
          />
          <Button
            type="submit"
            name="decision"
            value="rejected"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              decisionRef.current = "Request rejected";
            }}
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRejecting(false)}
          >
            ×
          </Button>
        </>
      ) : (
        <>
          <Button
            type="submit"
            name="decision"
            value="approved"
            size="sm"
            disabled={pending}
            onClick={() => {
              decisionRef.current = "Request approved";
            }}
          >
            {pending ? "…" : "Approve"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        </>
      )}
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
