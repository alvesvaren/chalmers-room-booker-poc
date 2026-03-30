import type {
  Booking,
  RoomCalendarSlot,
  RoomWithBookings,
} from "../client/types.gen";

/** Monday 00:00 local of the week containing `anchor`, plus `weekOffset` full weeks. `weekEnd` is exclusive (next Monday 00:00). */
export function getWeekRange(weekOffset: number, anchor: Date = new Date()) {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + toMonday + weekOffset * 7);
  const weekStart = new Date(d);
  const weekEnd = new Date(d);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { weekStart, weekEnd };
}

/** Monday-based week offset for the week containing `dateStr` (YYYY-MM-DD), relative to `getWeekRange(0, anchor)`. */
export function weekOffsetForLocalDate(
  dateStr: string,
  anchor: Date = new Date(),
): number {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const target = new Date(Y, M - 1, D, 12, 0, 0, 0);
  if (Number.isNaN(target.getTime())) return 0;
  const { weekStart: anchorMonday } = getWeekRange(0, anchor);
  const { weekStart: targetMonday } = getWeekRange(0, target);
  const msPerWeek = 7 * 24 * 60 * 60_000;
  return Math.round(
    (targetMonday.getTime() - anchorMonday.getTime()) / msPerWeek,
  );
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

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatLocalTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/** Local wall-clock instant for a calendar day (`YYYY-MM-DD`) and time (`HH:mm`). */
export function parseInstantOnDate(dateStr: string, timeStr: string): Date {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  return new Date(Y, M - 1, D, h, mi ?? 0, 0, 0);
}

/** TimeEdit only accepts bookings on quarter-hour boundaries in local time. */
export const QUARTER_HOUR_MS = 15 * 60_000;

/** Snap instant (local) to nearest quarter on the calendar day `dateStr` (YYYY-MM-DD). */
export function snapInstantMsToQuarterOnDate(
  ms: number,
  dateStr: string,
): number {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const day0 = new Date(Y, M - 1, D, 0, 0, 0, 0).getTime();
  const rel = ms - day0;
  return day0 + Math.round(rel / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
}

export function snapInstantMsToCeilQuarterOnDate(
  ms: number,
  dateStr: string,
): number {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const day0 = new Date(Y, M - 1, D, 0, 0, 0, 0).getTime();
  const rel = ms - day0;
  return day0 + Math.ceil(rel / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
}

export function formatWeekRangeLabel(weekStart: Date, weekEndExclusive: Date) {
  const lastDay = new Date(weekEndExclusive);
  lastDay.setDate(lastDay.getDate() - 1);
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(weekStart)}–${fmt.format(lastDay)}`;
}

export type TimeInterval = { start: Date; end: Date };

export type BusySegment = TimeInterval & {
  label?: string;
  reservationId?: string;
};

const MIN_GAP_MS = 60_000;

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
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
      start: new Date(
        Math.max(b.start.getTime(), windowStart.getTime()),
      ) as Date,
      end: new Date(Math.min(b.end.getTime(), windowEnd.getTime())) as Date,
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

function subtractBusyFromWindow(
  windowStart: Date,
  windowEnd: Date,
  busy: TimeInterval[],
): TimeInterval[] {
  const clipped = busy
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .map((b) => ({
      start: new Date(
        Math.max(b.start.getTime(), windowStart.getTime()),
      ) as Date,
      end: new Date(Math.min(b.end.getTime(), windowEnd.getTime())) as Date,
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

function startOfDayWithHour(d: Date, hour: number) {
  const x = new Date(d);
  x.setHours(hour, 0, 0, 0);
  return x;
}

export type DayTimeline = {
  date: Date;
  dateStr: string;
  weekdayShort: string;
  displayStart: Date;
  displayEnd: Date;
  busy: BusySegment[];
  free: TimeInterval[];
};

export const DEFAULT_DAY_START_H = 7;
export const DEFAULT_DAY_END_H = 22;

function slotToBusy(s: RoomCalendarSlot): BusySegment {
  return {
    start: parseNaiveLocal(s.start),
    end: parseNaiveLocal(s.end),
    label: s.label,
    reservationId: s.reservationId,
  };
}

/** True if this busy segment is the signed-in user's booking (room week grid or sheet). */
export function isMyCalendarBusy(
  segment: Pick<BusySegment, "start" | "end" | "reservationId">,
  roomId: string,
  roomName: string,
  myBookings: Booking[] | undefined,
): boolean {
  if (!myBookings?.length) return false;
  if (segment.reservationId) {
    return myBookings.some((m) => m.id === segment.reservationId);
  }
  const s0 = segment.start.getTime();
  const s1 = segment.end.getTime();
  return myBookings.some((m) => {
    const sameRoom =
      m.room.id != null ? m.room.id === roomId : m.room.name === roomName;
    if (!sameRoom) return false;
    const ms = parseNaiveLocal(m.start).getTime();
    const me = parseNaiveLocal(m.end).getTime();
    return ms < s1 && me > s0;
  });
}

/** Build per-day busy + free gaps for timeline rendering (clips to visible hours). */
export function buildRoomWeekTimeline(
  room: RoomWithBookings,
  weekStart: Date,
  weekEndExclusive: Date,
  dayStartH: number = DEFAULT_DAY_START_H,
  dayEndH: number = DEFAULT_DAY_END_H,
): DayTimeline[] {
  const busyAll: BusySegment[] = room.bookings.map(slotToBusy);

  const days: DayTimeline[] = [];
  for (
    let cursor = new Date(weekStart);
    cursor < weekEndExclusive;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const dayDate = new Date(cursor);
    const displayStart = startOfDayWithHour(dayDate, dayStartH);
    const displayEnd = startOfDayWithHour(dayDate, dayEndH);

    const dayEndMidnight = startOfDayWithHour(dayDate, 24);
    const dayStartMidnight = startOfDayWithHour(dayDate, 0);

    const busy = busyAll
      .filter((b) => b.end > dayStartMidnight && b.start < dayEndMidnight)
      .map((b) => ({
        start: new Date(
          Math.max(b.start.getTime(), dayStartMidnight.getTime()),
        ),
        end: new Date(Math.min(b.end.getTime(), dayEndMidnight.getTime())),
        label: b.label,
        reservationId: b.reservationId,
      }))
      .filter((b) => b.end > b.start);

    const busyForGaps = busy.map((b) => ({ start: b.start, end: b.end }));
    const mergedBusy = mergeIntervals(busyForGaps);
    const free = subtractBusyFromWindow(displayStart, displayEnd, mergedBusy);

    const weekdayShort = new Intl.DateTimeFormat("sv-SE", {
      weekday: "short",
    }).format(dayDate);

    days.push({
      date: dayDate,
      dateStr: formatLocalDate(dayDate),
      weekdayShort,
      displayStart,
      displayEnd,
      busy,
      free,
    });
  }
  return days;
}

/**
 * True if [intervalStart, intervalEnd) lies in the day's bookable window, does not overlap busy
 * (subset of a single free gap), and starts at or after `now` when `dateStr` is today.
 */
export function roomAvailableForInterval(
  room: RoomWithBookings,
  weekStart: Date,
  weekEndExclusive: Date,
  dateStr: string,
  intervalStart: Date,
  intervalEnd: Date,
  now: Date = new Date(),
  dayStartH: number = DEFAULT_DAY_START_H,
  dayEndH: number = DEFAULT_DAY_END_H,
): boolean {
  if (intervalEnd.getTime() - intervalStart.getTime() < MIN_GAP_MS) {
    return false;
  }
  const days = buildRoomWeekTimeline(
    room,
    weekStart,
    weekEndExclusive,
    dayStartH,
    dayEndH,
  );
  const day = days.find((d) => d.dateStr === dateStr);
  if (!day) return false;
  const t0 = intervalStart.getTime();
  const t1 = intervalEnd.getTime();
  if (t0 < day.displayStart.getTime() || t1 > day.displayEnd.getTime()) {
    return false;
  }
  if (formatLocalDate(now) === dateStr && t0 < now.getTime()) {
    return false;
  }
  return day.free.some((g) => g.start.getTime() <= t0 && g.end.getTime() >= t1);
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

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** Default booking length when opening the sheet (1 h, capped by gap end). */
export function defaultBookingWindow(gap: TimeInterval): TimeInterval {
  const oneHour = addMinutes(gap.start, 60);
  const endMs = Math.min(gap.end.getTime(), oneHour.getTime());
  return { start: gap.start, end: new Date(endMs) };
}

export function toBookingDraft(
  roomId: string,
  roomName: string | undefined,
  gap: TimeInterval,
): {
  roomId: string;
  roomName?: string;
  date: string;
  startTime: string;
  endTime: string;
} {
  const w = defaultBookingWindow(gap);
  const dateStr = formatLocalDate(w.start);
  let startMs = snapInstantMsToQuarterOnDate(w.start.getTime(), dateStr);
  if (startMs < gap.start.getTime()) {
    startMs = snapInstantMsToCeilQuarterOnDate(gap.start.getTime(), dateStr);
  }
  let endMs = Math.min(w.end.getTime(), gap.end.getTime());
  endMs = snapInstantMsToQuarterOnDate(endMs, dateStr);
  if (endMs <= startMs) {
    endMs = startMs + 60 * 60_000;
  }
  endMs = Math.min(endMs, gap.end.getTime());
  let dur = endMs - startMs;
  dur = Math.max(
    QUARTER_HOUR_MS,
    Math.round(dur / QUARTER_HOUR_MS) * QUARTER_HOUR_MS,
  );
  endMs = Math.min(startMs + dur, gap.end.getTime());
  endMs = snapInstantMsToQuarterOnDate(endMs, dateStr);
  if (endMs <= startMs) {
    endMs = Math.min(startMs + QUARTER_HOUR_MS, gap.end.getTime());
  }
  return {
    roomId,
    roomName,
    date: dateStr,
    startTime: formatLocalTime(new Date(startMs)),
    endTime: formatLocalTime(new Date(endMs)),
  };
}

/**
 * First free gap in the visible week that still has time left from `now` onward
 * (not in the past, not overlapping busy — same as free segments).
 */
export function firstFreeGapInWeek(
  room: RoomWithBookings,
  weekStart: Date,
  weekEndExclusive: Date,
  now: Date = new Date(),
): TimeInterval | null {
  const days = buildRoomWeekTimeline(
    room,
    weekStart,
    weekEndExclusive,
    DEFAULT_DAY_START_H,
    DEFAULT_DAY_END_H,
  );
  for (const d of days) {
    for (const g of d.free) {
      const clipped = clipIntervalToFuture(g, now);
      if (clipped) return clipped;
    }
  }
  return null;
}
