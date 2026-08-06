"use client";

import {
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "my-tasks": ListChecks,
  events: CalendarRange,
  approvals: ClipboardCheck,
  dashboard: LayoutDashboard,
  admin: Settings,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = ICONS[item.icon];

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}

export function EventNavLink({
  href,
  name,
  health,
}: {
  href: string;
  name: string;
  health: "on_track" | "at_risk" | "critical";
}) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          health === "on_track" && "bg-status-done",
          health === "at_risk" && "bg-status-in-progress",
          health === "critical" && "bg-status-blocked",
        )}
      />
      <span className="truncate">{name}</span>
    </Link>
  );
}
