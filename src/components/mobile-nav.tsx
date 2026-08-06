"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { EventNavLink, NavLink, type NavItem } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({
  items,
  events,
}: {
  items: NavItem[];
  events: Array<{ id: string; name: string; health: "on_track" | "at_risk" | "critical" }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="size-4" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-left text-sm font-semibold uppercase tracking-[0.2em]">
            RVC <span className="text-muted-foreground">Backstage</span>
          </SheetTitle>
        </SheetHeader>
        <div
          className="flex flex-col gap-4 p-3"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
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
      </SheetContent>
    </Sheet>
  );
}
