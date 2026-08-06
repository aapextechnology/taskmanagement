import Link from "next/link";
import { cn } from "@/lib/utils";

// Minimalist lockup echoing the RVC site: heavy type, tracking-wide, no icon.
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "select-none font-semibold uppercase leading-none tracking-[0.2em]",
        className,
      )}
    >
      RVC<span className="text-muted-foreground"> Backstage</span>
    </Link>
  );
}
