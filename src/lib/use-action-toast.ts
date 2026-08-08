"use client";

import { useEffect, useRef, type RefObject } from "react";
import { toast } from "sonner";

// Fires a success/error toast the moment a useActionState transition
// finishes (design overhaul, package B) — every mutation confirms itself
// instead of silently succeeding. Call unconditionally; it only reacts to
// pending flipping true → false.
//
// `successMessage` may be a plain string OR a ref (for callers whose
// message depends on which button was clicked, e.g. approve vs reject) —
// a ref is read here, inside the effect, never during render.
export function useActionToast(
  pending: boolean,
  error: string | undefined,
  successMessage: string | RefObject<string>,
) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      if (error) toast.error(error);
      else
        toast.success(
          typeof successMessage === "string" ? successMessage : successMessage.current,
        );
    }
    wasPending.current = pending;
    // successMessage is read fresh inside the effect; a ref is intentionally
    // NOT a dependency (its identity is stable, only .current changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, error]);
}
