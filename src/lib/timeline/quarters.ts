import { startOfLocalDayMs } from "../datetime";

/** TimeEdit only accepts bookings on quarter-hour boundaries in local time. */
export const QUARTER_HOUR_MS = 15 * 60_000;

/** Snap instant (local) to nearest quarter on the calendar day `dateStr` (YYYY-MM-DD). */
export function snapInstantMsToQuarterOnDate(
  ms: number,
  dateStr: string,
): number {
  const day0 = startOfLocalDayMs(dateStr);
  if (Number.isNaN(day0)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const rel = ms - day0;
  return day0 + Math.round(rel / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
}

export function snapInstantMsToCeilQuarterOnDate(
  ms: number,
  dateStr: string,
): number {
  const day0 = startOfLocalDayMs(dateStr);
  if (Number.isNaN(day0)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const rel = ms - day0;
  return day0 + Math.ceil(rel / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
}
