import { startOfDay } from "date-fns";

/** API returns naive local wall-clock strings (no timezone suffix). */
export function parseNaiveLocal(isoLike: string): Date {
  const normalized = isoLike.trim().replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${isoLike}`);
  }
  return d;
}

/**
 * Milliseconds for local calendar date + time, or NaN if parts are not finite numbers.
 * Single implementation shared with {@link parseInstantOnDate}.
 */
export function localWallClockMs(dateStr: string, timeStr: string): number {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const [hRaw, mRaw] = timeStr.trim().split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (
    !Number.isFinite(Y) ||
    !Number.isFinite(M) ||
    !Number.isFinite(D) ||
    !Number.isFinite(h) ||
    !Number.isFinite(m)
  ) {
    return NaN;
  }
  return new Date(Y, M - 1, D, h, m, 0, 0).getTime();
}

/** Local wall-clock instant for a calendar day (`YYYY-MM-DD`) and time (`HH:mm`). */
export function parseInstantOnDate(dateStr: string, timeStr: string): Date {
  const ms = localWallClockMs(dateStr, timeStr);
  return new Date(ms);
}

/** Start of local calendar day for `YYYY-MM-DD` as epoch ms; NaN if date is invalid. */
export function startOfLocalDayMs(dateStr: string): number {
  const [Y, M, D] = dateStr.split("-").map(Number);
  if (
    !Number.isFinite(Y) ||
    !Number.isFinite(M) ||
    !Number.isFinite(D)
  ) {
    return NaN;
  }
  return startOfDay(new Date(Y, M - 1, D)).getTime();
}
