import { setHours, startOfDay } from "date-fns";

/** Clock time on the same local calendar day as `day` (`hour` 24 → next calendar midnight). */
export function atLocalHourOnCalendarDay(day: Date, hour: number): Date {
  return setHours(startOfDay(day), hour);
}
