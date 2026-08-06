// Next.js instrumentation hook — runs once per server boot (nodejs runtime).
// Hosts the in-process background jobs (PLAN §7: node-cron inside the app).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = (await import("node-cron")).default;
  const { recomputeAllEventHealth } = await import("@/lib/events/service");

  // hourly health sweep; mutations also trigger targeted recomputes
  cron.schedule("0 * * * *", async () => {
    try {
      const n = await recomputeAllEventHealth();
      console.log(`[cron] event health recomputed for ${n} events`);
    } catch (error) {
      console.error("[cron] health recompute failed:", error);
    }
  });
}
