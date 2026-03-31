/** Public entry: room/week timeline and booking helpers (implementation in `./timeline/`). */

export {
  formatCreateBookingInterval,
  formatLocalDateWire as formatLocalDate,
  formatLocalTime24 as formatLocalTime,
  formatWeekRangeLabel,
  parseApiInterval,
  parseInstantOnDate,
  parseNaiveLocal,
} from "./datetime";

export type { BusySegment, DayTimeline, TimeInterval } from "./timeline/types";

export { addMinutes } from "date-fns";

export { defaultBookingWindow, toBookingDraft } from "./timeline/bookingDraft";

export {
  busyIntervalsForWindow,
  clipIntervalToFuture,
  freeSlotsInWindow,
  intervalToPercent,
  splitFreeGapForDisplay,
} from "./timeline/intervals";

export {
  QUARTER_HOUR_MS,
  snapInstantMsToCeilQuarterOnDate,
  snapInstantMsToQuarterOnDate,
} from "./timeline/quarters";

export {
  DEFAULT_DAY_END_H,
  DEFAULT_DAY_START_H,
  buildRoomWeekTimeline,
  firstFreeGapInWeek,
  isMyCalendarBusy,
  roomAvailableForInterval,
} from "./timeline/roomWeekTimeline";

export type { WeekRange } from "./timeline/weekRange";
export { getWeekRange, weekOffsetForLocalDate } from "./timeline/weekRange";
