import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Default the test runner's timezone to UTC for determinism, but don't
    // clobber an explicitly-set TZ (e.g. `TZ=Asia/Jakarta npx vitest run`)
    // used to prove calendar/task day-bucketing (src/lib/calendar/aggregate.ts,
    // src/lib/tasks/dates.ts) is host-TZ-independent — it computes the
    // explicit Asia/Jakarta (WIB) calendar day via UTC-instant arithmetic.
    env: { TZ: process.env.TZ ?? "UTC" },
  },
});
