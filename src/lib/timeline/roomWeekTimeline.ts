import { eachDayOfInterval, subDays } from "date-fns";
import type {
  MyBooking,
  ReservationSlot,
  RoomWithReservations,
} from "../../client/types.gen";
import {
  atLocalHourOnCalendarDay,
  formatLocalDateWire,
  formatWeekdayShort,
  parseApiInterval,
} from "../datetime";
import {
  clipIntervalToFuture,
  mergeIntervals,
  MIN_GAP_MS,
  subtractBusyFromWindow,
} from "./intervals";
import type { BusySegment, DayTimeline, TimeInterval } from "./types";

export const DEFAULT_DAY_START_H = 7;
export const DEFAULT_DAY_END_H = 22;

function slotToBusy(s: ReservationSlot): BusySegment {
  const { start, end } = parseApiInterval(s.interval);
  return {
    start,
    end,
    label: s.label,
    reservationId: s.id,
  };
}

/** True if this busy segment is the signed-in user's booking (room week grid or sheet). */
export function isMyCalendarBusy(
  segment: Pick<BusySegment, "start" | "end" | "reservationId">,
  roomId: string,
  myBookings: MyBooking[] | undefined,
): boolean {
  if (!myBookings?.length) return false;
  if (segment.reservationId) {
    return myBookings.some((m) => m.id === segment.reservationId);
  }
  const s0 = segment.start.getTime();
  const s1 = segment.end.getTime();
  return myBookings.some((m) => {
    if (m.roomId !== roomId) return false;
    const { start: ms, end: me } = parseApiInterval(m.interval);
    return ms.getTime() < s1 && me.getTime() > s0;
  });
}

/** Build per-day busy + free gaps for timeline rendering (clips to visible hours). */
export function buildRoomWeekTimeline(
  room: RoomWithReservations,
  weekStart: Date,
  weekEndExclusive: Date,
  dayStartH: number = DEFAULT_DAY_START_H,
  dayEndH: number = DEFAULT_DAY_END_H,
): DayTimeline[] {
  const busyAll: BusySegment[] = room.bookings.map(slotToBusy);

  const days: DayTimeline[] = [];
  const lastDay = subDays(weekEndExclusive, 1);
  for (const dayDate of eachDayOfInterval({
    start: weekStart,
    end: lastDay,
  })) {
    const displayStart = atLocalHourOnCalendarDay(dayDate, dayStartH);
    const displayEnd = atLocalHourOnCalendarDay(dayDate, dayEndH);

    const dayEndMidnight = atLocalHourOnCalendarDay(dayDate, 24);
    const dayStartMidnight = atLocalHourOnCalendarDay(dayDate, 0);

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

    const weekdayShort = formatWeekdayShort(dayDate);

    days.push({
      date: dayDate,
      dateStr: formatLocalDateWire(dayDate),
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
  room: RoomWithReservations,
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
  if (formatLocalDateWire(now) === dateStr && t0 < now.getTime()) {
    return false;
  }
  return day.free.some((g) => g.start.getTime() <= t0 && g.end.getTime() >= t1);
}

/**
 * First free gap in the visible week that still has time left from `now` onward
 * (not in the past, not overlapping busy — same as bookable segments).
 */
export function firstFreeGapInWeek(
  room: RoomWithReservations,
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
