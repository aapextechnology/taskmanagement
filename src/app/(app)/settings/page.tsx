import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { sessionActor } from "@/lib/auth/session-actor";
import { can } from "@/lib/permissions";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Settings" };

// T-100: self-service notification & digest preferences.
export default async function SettingsPage() {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const [me] = await db
    .select({
      emailNotifications: profiles.emailNotifications,
      whatsappNotifications: profiles.whatsappNotifications,
      dailyDigest: profiles.dailyDigest,
      weeklyDigest: profiles.weeklyDigest,
      phone: profiles.phone,
    })
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1);
  if (!me) redirect("/login");

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Notifications and digests — all channels are yours to switch.
        </p>
      </div>
      <PreferencesForm
        initial={{
          emailNotifications: me.emailNotifications,
          whatsappNotifications: me.whatsappNotifications,
          dailyDigest: me.dailyDigest,
          weeklyDigest: me.weeklyDigest,
          phone: me.phone ?? "",
        }}
        showWeekly={can(actor, "dashboard.view")}
      />
    </section>
  );
}
