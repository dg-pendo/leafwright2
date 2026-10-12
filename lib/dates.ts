const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Whole days from now until an ISO timestamp, never negative. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY));
}

/** Whole days since an ISO timestamp, never negative. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY));
}

/** Hours since an ISO timestamp to one decimal place, never negative. */
export function hoursSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.round(((now.getTime() - new Date(iso).getTime()) / HOUR) * 10) / 10);
}

/** Days from one ISO timestamp to another, rounded to the nearest whole day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY);
}
