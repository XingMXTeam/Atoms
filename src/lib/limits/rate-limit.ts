/**
 * Calendar bucketing for usage rows.
 * Platform-demo vs BYOK decisions live in `demo-policy.ts`.
 * The old per-device run cap and 500k global token soft-cap no longer
 * authorize platform model calls.
 */

export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function utcMonth(date: Date = new Date()): string {
  return utcDay(date).slice(0, 7);
}
