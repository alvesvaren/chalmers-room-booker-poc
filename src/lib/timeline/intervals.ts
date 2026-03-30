import type { TimeInterval } from "./types";

export const MIN_GAP_MS = 60_000;

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const out: TimeInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) {
        last.end = cur.end;
      }
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Busy segments clipped to the visible window and merged (for timeline-style blocks). */
export function busyIntervalsForWindow(
  windowStart: Date,
  windowEnd: Date,
  segments: TimeInterval[],
): TimeInterval[] {
  const clipped = segments
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .map((b) => ({
      start: new Date(Math.max(b.start.getTime(), windowStart.getTime())),
      end: new Date(Math.min(b.end.getTime(), windowEnd.getTime())),
    }))
    .filter((b) => b.end > b.start);
  return mergeIntervals(clipped);
}

/** Free gaps inside [windowStart, windowEnd) given busy wall-clock segments (any length). */
export function freeSlotsInWindow(
  windowStart: Date,
  windowEnd: Date,
  segments: TimeInterval[],
): TimeInterval[] {
  const busy = busyIntervalsForWindow(windowStart, windowEnd, segments);
  return subtractBusyFromWindow(windowStart, windowEnd, busy);
}

export function subtractBusyFromWindow(
  windowStart: Date,
  windowEnd: Date,
  busy: TimeInterval[],
): TimeInterval[] {
  const clipped = busy
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .map((b) => ({
      start: new Date(Math.max(b.start.getTime(), windowStart.getTime())),
      end: new Date(Math.min(b.end.getTime(), windowEnd.getTime())),
    }));
  const merged = mergeIntervals(clipped);
  const gaps: TimeInterval[] = [];
  let cursor = windowStart.getTime();
  for (const b of merged) {
    if (b.start.getTime() > cursor) {
      gaps.push({ start: new Date(cursor), end: new Date(b.start.getTime()) });
    }
    cursor = Math.max(cursor, b.end.getTime());
  }
  if (cursor < windowEnd.getTime()) {
    gaps.push({ start: new Date(cursor), end: new Date(windowEnd.getTime()) });
  }
  return gaps.filter((g) => g.end.getTime() - g.start.getTime() >= MIN_GAP_MS);
}

/** Trim interval to only the part at or after `now`. Null if nothing usable remains. */
export function clipIntervalToFuture(
  interval: TimeInterval,
  now: Date = new Date(),
): TimeInterval | null {
  const startMs = Math.max(interval.start.getTime(), now.getTime());
  const endMs = interval.end.getTime();
  if (endMs - startMs < MIN_GAP_MS) return null;
  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * Split a free gap for the timeline: past (already elapsed) vs future (bookable).
 * If the remainder before gap.end is shorter than MIN_GAP_MS, the whole gap is treated as past.
 */
export function splitFreeGapForDisplay(
  gap: TimeInterval,
  now: Date,
): { past: TimeInterval | null; future: TimeInterval | null } {
  const i0 = gap.start.getTime();
  const i1 = gap.end.getTime();
  const n = now.getTime();
  if (i1 <= n) {
    return { past: gap, future: null };
  }
  if (i0 >= n) {
    const future = clipIntervalToFuture(gap, now);
    if (!future) return { past: gap, future: null };
    return { past: null, future };
  }
  const future = clipIntervalToFuture(
    { start: new Date(n), end: gap.end },
    now,
  );
  if (!future) {
    return { past: gap, future: null };
  }
  return {
    past: { start: gap.start, end: new Date(n) },
    future,
  };
}

/** Position as % of [windowStart, windowEnd]: { left, width } for CSS. */
export function intervalToPercent(
  interval: TimeInterval,
  windowStart: Date,
  windowEnd: Date,
) {
  const w0 = windowStart.getTime();
  const w1 = windowEnd.getTime();
  const span = w1 - w0;
  if (span <= 0) return { leftPct: 0, widthPct: 0 };
  const t0 = Math.max(interval.start.getTime(), w0);
  const t1 = Math.min(interval.end.getTime(), w1);
  const leftPct = ((t0 - w0) / span) * 100;
  const widthPct = Math.max(0, ((t1 - t0) / span) * 100);
  return { leftPct, widthPct };
}
