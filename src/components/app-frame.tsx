"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Route-aware shell frame (Owner 2026-08-07): a few screens get a fullscreen
// canvas — the main sidebar hides and the content well widens. Navigation
// stays reachable via the hamburger sheet (see MobileNav, which shows itself
// on desktop for fullscreen routes).
//
// The dataroom joined them (Owner 2026-08-11): a file manager competes with
// the sidebar for the same left column, and two nested trees side by side is
// exactly what makes people lose their place.
const FULLSCREEN_ROUTES = [/^\/assistant/, /^\/events\/[^/]+\/dataroom/];
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
  const fullscreen = FULLSCREEN_ROUTES.some((r) => r.test(pathname));

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
          {/* keyed on the route so the entrance replays on navigation: <main>
              itself survives a client-side transition, so without this the
              animation would only ever run on a full page load */}
          <div key={pathname} className="rise-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
