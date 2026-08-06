// Next.js instrumentation hook — runs once per server boot (nodejs runtime).
// Hosts the in-process background jobs (PLAN §7: node-cron inside the app).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = (await import("node-cron")).default;
  const { recomputeAllEventHealth } = await import("@/lib/events/service");
  const { sweepDueNotifications } = await import("@/lib/tasks/service");

  // hourly: due/overdue notifications (deduped) then health sweep;
  // mutations also trigger targeted recomputes
  cron.schedule("0 * * * *", async () => {
    try {
      await sweepDueNotifications();
      const n = await recomputeAllEventHealth();
      console.log(`[cron] due sweep + health recompute for ${n} events`);
    } catch (error) {
      console.error("[cron] sweep failed:", error);
    }
  });

  // digests (T-100) — opt-in, WIB mornings; timezone pinned so the container
  // TZ (UTC) never shifts the send hour
  const { sendDailyDigests, sendWeeklyDigests } = await import(
    "@/lib/digests/service"
  );
  cron.schedule(
    "0 7 * * *",
    async () => {
      try {
        const n = await sendDailyDigests();
        console.log(`[cron] daily digest sent to ${n} users`);
      } catch (error) {
        console.error("[cron] daily digest failed:", error);
      }
    },
    { timezone: "Asia/Jakarta" },
  );
  cron.schedule(
    "0 7 * * 1",
    async () => {
      try {
        const n = await sendWeeklyDigests();
        console.log(`[cron] weekly executive digest sent to ${n} users`);
      } catch (error) {
        console.error("[cron] weekly digest failed:", error);
      }
    },
    { timezone: "Asia/Jakarta" },
  );
}
