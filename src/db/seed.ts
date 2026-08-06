import { db } from "./index";
import { appSettings } from "./schema";

// Idempotent seed (T-003 skeleton). Each epic extends `steps` with its own
// fixtures: divisions + demo users (T-010/T-015), demo event (T-020)…
const steps: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "default org settings",
    run: async () => {
      await db
        .insert(appSettings)
        .values([
          { key: "currency", value: "IDR" },
          // Proposed defaults — Owner confirms real numbers (PRD open question).
          { key: "approval_threshold_a", value: 10_000_000 },
          { key: "approval_threshold_b", value: 100_000_000 },
        ])
        .onConflictDoNothing();
    },
  },
];

async function main() {
  for (const step of steps) {
    await step.run();
    console.log(`[seed] ${step.name} ✓`);
  }
  console.log("[seed] done");
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
