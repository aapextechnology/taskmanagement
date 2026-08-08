import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The ↗ motif: every navigational action carries the up-right arrow.
// The arrow nudges on hover — the site's signature micro-interaction.
export function ActionLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link
      {...props}
      className={cn(
        "group inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wider",
        "text-foreground underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
      <ArrowUpRight
        aria-hidden
        className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
