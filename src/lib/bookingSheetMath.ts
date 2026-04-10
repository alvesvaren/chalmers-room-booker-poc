import {
  formatLocalDateWire,
  formatLocalTime24,
  LOCAL_MIDNIGHT_TIME,
  localWallClockMs,
  parseInstantOnDate,
} from "./datetime";
import { setHours } from "date-fns";
import {
  DEFAULT_DAY_END_H,
  DEFAULT_DAY_START_H,
  QUARTER_HOUR_MS,
  snapInstantMsToCeilQuarterOnDate,
  snapInstantMsToQuarterOnDate,
  type TimeInterval,
} from "./weekTimeline";

export const MIN_BOOK_DURATION_MIN = 15;
export const MAX_BOOK_DURATION_MIN = 240;
/** Quick presets (min). 15+ still allowed via timeline / manual times. */
export const DURATION_CHIPS_MIN = [30, 60, 90, 120, 240] as const;

/**
 * Next quarter-hour start on `dateStr` relative to `now` (local).
 * Past calendar days → default day start; future days → default day start;
 * today → ceil current time to 15 minutes, clamped to 23:45 same day.
 */
export function defaultAvailabilityFilterStartTime(
  dateStr: string,
  now: Date = new Date(),
): string {
  const todayStr = formatLocalDateWire(now);
  const dayStart = `${String(DEFAULT_DAY_START_H).padStart(2, "0")}:00`;
  if (dateStr !== todayStr) {
    return dayStart;
  }
  const ceiled = snapInstantMsToCeilQuarterOnDate(now.getTime(), dateStr);
  if (formatLocalDateWire(new Date(ceiled)) !== dateStr) {
    return "23:45";
  }
  return formatLocalTime24(new Date(ceiled));
}

export function isLocalStartInPast(
  dateStr: string,
  timeStr: string,
  now: Date,
): boolean {
  const t = localWallClockMs(dateStr, timeStr);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

export function dayDisplayBounds(dateStr: string): { start: Date; end: Date } {
  const day = parseInstantOnDate(dateStr, LOCAL_MIDNIGHT_TIME);
  return {
    start: setHours(day, DEFAULT_DAY_START_H),
    end: setHours(day, DEFAULT_DAY_END_H),
  };
}

export function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Snap/clamp a wall-clock interval to [windowStart, windowEnd] without busy-gap logic.
 * Used by the “free at time” filter timeline (open day track).
 */
export function clampIntervalToDayWindow(
  s: number,
  e: number,
  dateStr: string,
  windowStart: Date,
  windowEnd: Date,
): [number, number] {
  const snap = (ms: number) => snapInstantMsToQuarterOnDate(ms, dateStr);
  const w0 = windowStart.getTime();
  const w1 = windowEnd.getTime();
  if (!Number.isFinite(w0) || !Number.isFinite(w1) || w1 <= w0) {
    const s0 = snap(s);
    return [s0, snap(s0 + MIN_BOOK_DURATION_MIN * 60_000)];
  }

  let dur = snap(e) - snap(s);
  if (!Number.isFinite(dur) || dur <= 0)
    dur = MIN_BOOK_DURATION_MIN * 60_000;
  dur = Math.max(
    MIN_BOOK_DURATION_MIN * 60_000,
    Math.round(dur / QUARTER_HOUR_MS) * QUARTER_HOUR_MS,
  );
  dur = Math.min(dur, MAX_BOOK_DURATION_MIN * 60_000);

  const spanMs = w1 - w0;
  const maxDurFit = Math.max(
    MIN_BOOK_DURATION_MIN * 60_000,
    Math.floor(spanMs / QUARTER_HOUR_MS) * QUARTER_HOUR_MS,
  );
  dur = Math.min(dur, maxDurFit);

  const lo = w0;
  let hi = w1 - dur;
  if (hi < lo) {
    dur = maxDurFit;
    hi = w1 - dur;
  }
  if (hi < lo) {
    const s0 = snap(w0);
    const e0 = Math.min(w1, s0 + MIN_BOOK_DURATION_MIN * 60_000);
    return [s0, snap(e0)];
  }

  const startMs = clampNum(snap(s), lo, hi);
  return [snap(startMs), snap(startMs + dur)];
}

export function intervalFitsInFreeGaps(
  s: number,
  e: number,
  gaps: TimeInterval[],
): boolean {
  if (e <= s) return false;
  return gaps.some((g) => s >= g.start.getTime() && e <= g.end.getTime());
}

/** Snap interval into a single free gap; picks closest valid slot to the proposed times. */
export function clampToFreeGaps(
  s: number,
  e: number,
  gaps: TimeInterval[],
  dateStr: string,
): [number, number] {
  const snap = (ms: number) => snapInstantMsToQuarterOnDate(ms, dateStr);
  if (gaps.length === 0) {
    const s0 = snap(s);
    let dur = e - s;
    dur = Math.max(
      MIN_BOOK_DURATION_MIN * 60_000,
      Math.round(dur / QUARTER_HOUR_MS) * QUARTER_HOUR_MS,
    );
    dur = Math.min(dur, MAX_BOOK_DURATION_MIN * 60_000);
    return [s0, snap(s0 + dur)];
  }

  let dur = e - s;
  if (dur < MIN_BOOK_DURATION_MIN * 60_000)
    dur = MIN_BOOK_DURATION_MIN * 60_000;
  if (dur > MAX_BOOK_DURATION_MIN * 60_000)
    dur = MAX_BOOK_DURATION_MIN * 60_000;
  dur = Math.round(dur / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
  dur = clampNum(
    dur,
    MIN_BOOK_DURATION_MIN * 60_000,
    MAX_BOOK_DURATION_MIN * 60_000,
  );

  const sAdj = s;
  const eAdj = sAdj + dur;

  if (intervalFitsInFreeGaps(sAdj, eAdj, gaps)) {
    return [snap(sAdj), snap(eAdj)];
  }

  let best: [number, number] | null = null;
  let bestDist = Infinity;

  for (const g of gaps) {
    const g0 = g.start.getTime();
    const g1 = g.end.getTime();
    const room = g1 - g0;
    const minDur = MIN_BOOK_DURATION_MIN * 60_000;
    const maxDurAll = Math.min(MAX_BOOK_DURATION_MIN * 60_000, room);
    if (room < minDur) continue;

    const maxDurQuarter =
      Math.floor(maxDurAll / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
    if (maxDurQuarter < minDur) continue;

    const durUse = clampNum(dur, minDur, maxDurQuarter);
    const durUseQ = Math.round(durUse / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
    const durF = clampNum(durUseQ, minDur, maxDurQuarter);
    const sLo = g0;
    const sHi = g1 - durF;
    if (sHi < sLo) continue;

    const sClamped = clampNum(sAdj, sLo, sHi);
    const eClamped = sClamped + durF;
    const dist = Math.abs(sClamped - s) + Math.abs(eClamped - e);
    if (dist < bestDist) {
      bestDist = dist;
      best = [sClamped, eClamped];
    }
  }

  if (!best) return [snap(sAdj), snap(eAdj)];
  return [snap(best[0]), snap(best[1])];
}
