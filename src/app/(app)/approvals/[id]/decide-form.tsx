"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";
import { decideAction, type ApprovalActionState } from "../actions";

export function DecideForm({ approvalId }: { approvalId: string }) {
  const [state, formAction, pending] = useActionState<
    ApprovalActionState,
    FormData
  >(decideAction, {});
  const decisionRef = useRef("Decision recorded");
  useActionToast(pending, state.error, decisionRef);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border p-4"
    >
      <input type="hidden" name="approvalId" value={approvalId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="dc-comment">
          Comment (required unless approving)
        </Label>
        <textarea
          id="dc-comment"
          name="comment"
          rows={2}
          className="border-input rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          onClick={() => {
            decisionRef.current = "Request approved";
          }}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="changes_requested"
          variant="outline"
          disabled={pending}
          onClick={() => {
            decisionRef.current = "Changes requested";
          }}
        >
          Request changes
        </Button>
        <Button
          type="submit"
          name="decision"
          value="rejected"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            decisionRef.current = "Request rejected";
          }}
        >
          Reject
        </Button>
      </div>
    </form>
  );
}
