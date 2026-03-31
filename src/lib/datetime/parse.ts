import { startOfDay } from "date-fns";
import { formatLocalDateWire } from "./intlFormat";

const END_TIME_ONLY_RE = /^\d{1,2}:\d{2}$/;

/**
 * Parses API v2 `interval` strings (Europe/Stockholm wall time): `YYYY-MM-DDTHH:mm/HH:mm` or
 * `…/YYYY-MM-DDTHH:mm` for an end on another calendar day.
 */
export function parseApiInterval(interval: string): { start: Date; end: Date } {
  const slash = interval.indexOf("/");
  if (slash < 0) {
    throw new Error(`Invalid interval (expected start/end): ${interval}`);
  }
  const startPart = interval.slice(0, slash).trim();
  const endPart = interval.slice(slash + 1).trim();
  if (!startPart || !endPart) {
    throw new Error(`Invalid interval: ${interval}`);
  }
  const start = parseNaiveLocal(startPart);
  if (END_TIME_ONLY_RE.test(endPart)) {
    const dayWire = formatLocalDateWire(start);
    const end = parseInstantOnDate(dayWire, endPart);
    return { start, end };
  }
  const end = parseNaiveLocal(endPart);
  return { start, end };
}

/** Builds the `interval` field for `POST /api/my/bookings` (same calendar day). */
export function formatCreateBookingInterval(
  date: string,
  startTime: string,
  endTime: string,
): string {
  const s = startTime.trim();
  const e = endTime.trim();
  if (!date || !s || !e) {
    throw new Error("formatCreateBookingInterval: missing date or time");
  }
  return `${date}T${s}/${e}`;
}

/** API returns naive local wall-clock strings (no timezone suffix). */
export function parseNaiveLocal(isoLike: string): Date {
  const normalized = isoLike.trim().replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${isoLike}`);
  }
  return d;
}

function ymdFromWireDate(dateStr: string): [number, number, number] | null {
  const [Y, M, D] = dateStr.split("-").map(Number);
  if (
    !Number.isFinite(Y) ||
    !Number.isFinite(M) ||
    !Number.isFinite(D)
  ) {
    return null;
  }
  return [Y, M, D];
}

/**
 * Milliseconds for local calendar date + time, or NaN if parts are not finite numbers.
 * Single implementation shared with {@link parseInstantOnDate}.
 */
export function localWallClockMs(dateStr: string, timeStr: string): number {
  const ymd = ymdFromWireDate(dateStr);
  if (!ymd) return NaN;
  const [Y, M, D] = ymd;
  const [hRaw, mRaw] = timeStr.trim().split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
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
  const ymd = ymdFromWireDate(dateStr);
  if (!ymd) return NaN;
  const [Y, M, D] = ymd;
  return startOfDay(new Date(Y, M - 1, D)).getTime();
}
