import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/lib/auth";

export const metadata: Metadata = { title: "My Tasks" };

// Placeholder until T-033 builds the real today/this-week/overdue buckets.
export default async function MyTasksPage() {
  const session = await auth();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold uppercase tracking-tight">
          My Tasks
        </h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Signed in as {session?.user?.name} ({session?.user?.role}). Task buckets
        land with EPIC-003.
      </p>
    </section>
  );
}
