import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { EventNavLink, NavLink, type NavItem } from "@/components/nav-link";
import { NotificationsBell } from "@/components/notifications-bell";
import { UserAvatar } from "@/components/task-meta";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/lib/auth";
import { sessionActor } from "@/lib/auth/session-actor";
import { listActiveEvents } from "@/lib/events/service";
import { can } from "@/lib/permissions";

// Plane-style shell (T-110): fixed left sidebar (nav + events + user block),
// slim top bar on mobile. Content scrolls independently.
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();
  const actor = session?.user?.id ? await sessionActor() : null;

  const items: NavItem[] = [
    { href: "/my-tasks", label: "My Tasks", icon: "my-tasks" },
    { href: "/events", label: "Events", icon: "events" },
    { href: "/approvals", label: "Approvals", icon: "approvals" },
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    ...(actor && can(actor, "org.manage")
      ? [{ href: "/admin", label: "Admin", icon: "admin" as const }]
      : []),
  ];

  const events =
    actor && can(actor, "event.view")
      ? (await listActiveEvents(actor)).map((e) => ({
          id: e.id,
          name: e.name,
          health: e.health,
        }))
      : [];

  return (
    <div className="flex min-h-svh">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Logo className="text-[13px]" />
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
          <nav className="flex flex-col gap-0.5">
            {items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
          {events.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Events
              </span>
              {events.map((event) => (
                <EventNavLink
                  key={event.id}
                  href={`/events/${event.id}`}
                  name={event.name}
                  health={event.health}
                />
              ))}
            </div>
          ) : null}
        </div>
        {session?.user ? (
          <div className="flex items-center gap-2 border-t p-3">
            <UserAvatar name={session.user.name ?? "?"} className="size-7 text-[10px]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium">
                {session.user.name}
              </span>
              <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {session.user.role}
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                className="text-xs text-muted-foreground"
              >
                Out
              </Button>
            </form>
          </div>
        ) : null}
      </aside>

      {/* content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <MobileNav items={items} events={events} />
            <Logo className="text-[13px] md:hidden" />
          </div>
          <div className="flex items-center gap-1">
            {session?.user ? <NotificationsBell /> : null}
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
