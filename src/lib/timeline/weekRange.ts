import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { parseInstantOnDate } from "../datetime";

const DAYS_PER_WEEK = 7;

/** Monday-first week (must match grid navigation and server `weekOffset`). */
const WEEK_OPTIONS_MONDAY_FIRST = { weekStartsOn: 1 as const };

/**
 * Local noon when turning a calendar `YYYY-MM-DD` into a `Date` for week arithmetic,
 * so the instant stays on the intended calendar day across DST transitions.
 */
const CALENDAR_DATE_ANCHOR_TIME = "12:00";

function startOfMondayWeekContaining(d: Date): Date {
  return startOfWeek(startOfDay(d), WEEK_OPTIONS_MONDAY_FIRST);
}

export type WeekRange = { weekStart: Date; weekEnd: Date };

/** Monday 00:00 local of the week containing `anchor`, plus `weekOffset` full weeks. `weekEnd` is exclusive (next Monday 00:00). */
export function getWeekRange(
  weekOffset: number,
  anchor: Date = new Date(),
): WeekRange {
  const monday0 = startOfMondayWeekContaining(anchor);
  const weekStart = addWeeks(monday0, weekOffset);
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK);
  return { weekStart, weekEnd };
}

/** Monday-based week offset for the week containing `dateStr` (YYYY-MM-DD), relative to `getWeekRange(0, anchor)`. */
export function weekOffsetForLocalDate(
  dateStr: string,
  anchor: Date = new Date(),
): number {
  const target = parseInstantOnDate(dateStr, CALENDAR_DATE_ANCHOR_TIME);
  if (Number.isNaN(target.getTime())) return 0;
  const anchorMonday = startOfMondayWeekContaining(anchor);
  const targetMonday = startOfMondayWeekContaining(target);
  return differenceInCalendarWeeks(
    targetMonday,
    anchorMonday,
    WEEK_OPTIONS_MONDAY_FIRST,
  );
}
