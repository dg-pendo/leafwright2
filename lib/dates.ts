const DAY = 24 * 60 * 60 * 1000;

/** Whole days from now until an ISO timestamp, never negative. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY));
}
