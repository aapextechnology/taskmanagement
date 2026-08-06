// Pure countdown math for the show-day timer (shared across event surfaces).
// Kept free of React so it is unit-testable and reusable server-side.

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** true once the target moment has passed */
  reached: boolean;
}

export function countdownTo(target: Date, now: Date): CountdownParts {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, reached: true };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    reached: false,
  };
}
