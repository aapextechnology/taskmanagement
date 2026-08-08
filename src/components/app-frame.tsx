"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Route-aware shell frame (Owner 2026-08-07): the AI Assistant gets a
// fullscreen canvas — the main sidebar hides and the content well widens.
// Navigation stays reachable via the hamburger sheet (see MobileNav, which
// shows itself on desktop for fullscreen routes).
export function AppFrame({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const fullscreen = pathname.startsWith("/assistant");

  return (
    <div className="flex min-h-svh">
      {fullscreen ? null : sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main
          className={cn(
            "w-full flex-1 px-4 py-6 sm:px-6",
            fullscreen ? "mx-auto max-w-none" : "mx-auto max-w-[1400px]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
