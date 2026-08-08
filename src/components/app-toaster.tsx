"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

// Global toast surface (design overhaul 2026-08-07, package B): every
// mutation now confirms itself — lay users stop double-clicking "did it work?"
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === "light" ? "light" : "dark"}
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--card-foreground)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-elev-hover)",
        },
      }}
    />
  );
}
