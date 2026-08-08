import Link from "next/link";
import { cn } from "@/lib/utils";

// Minimalist lockup: heavy type, tracking-wide, no icon. Both halves come
// from the installation's branding settings (src/lib/org/branding.ts) so the
// app carries the installing organisation's name, not ours.
export function Logo({
  short,
  product,
  className,
}: {
  short: string;
  product: string;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "select-none font-semibold uppercase leading-none tracking-[0.2em]",
        className,
      )}
    >
      {short}
      <span className="text-muted-foreground"> {product}</span>
    </Link>
  );
}
