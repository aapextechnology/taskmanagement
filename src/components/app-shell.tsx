import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/auth";

// Global frame: hairline-bordered top bar + gallery-width content column.
// Nav is role-aware: Admin appears for owner/admin only. Events/Dashboard
// are placeholders until EPIC-002/EPIC-006 land their pages.
const NAV = [
  { href: "/my-tasks", label: "My Tasks" },
  { href: "/events", label: "Events" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  const items = [
    ...NAV,
    ...(role === "owner" || role === "admin"
      ? [{ href: "/admin", label: "Admin" } as const]
      : []),
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo className="text-sm" />
          <nav className="flex items-center gap-6">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {session?.user ? <NotificationsBell /> : null}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
