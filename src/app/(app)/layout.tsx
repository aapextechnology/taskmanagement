import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";

// Everything inside (app) requires a signed-in user. Page-level capability
// checks still go through src/lib/permissions — this only gates "signed in".
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
