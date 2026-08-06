import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";

// Everything inside (app) requires a signed-in user. Page-level capability
// checks still go through src/lib/permissions — this only gates "signed in".
// `modal` is the intercepting slot for the task peek drawer (T-111).
export default async function AppLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell>
      {children}
      {modal}
    </AppShell>
  );
}
