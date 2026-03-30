import {
  LOCAL_MIDNIGHT_TIME,
  localWallClockMs,
  parseInstantOnDate,
} from "./datetime";
import { setHours } from "date-fns";
import {
  DEFAULT_DAY_END_H,
  DEFAULT_DAY_START_H,
  QUARTER_HOUR_MS,
  snapInstantMsToQuarterOnDate,
  type TimeInterval,
} from "./weekTimeline";

export const MIN_BOOK_DURATION_MIN = 15;
export const MAX_BOOK_DURATION_MIN = 240;
export const DURATION_CHIPS_MIN = [15, 30, 60, 90, 120, 240] as const;

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
