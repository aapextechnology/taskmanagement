"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function TaskPeek({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-5 pt-10 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">Task detail</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
