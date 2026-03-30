/** Pinned for consistent UI copy and calendar strings (Chalmers / Sweden). */
export const APP_LOCALE = "sv-SE";

/**
 * `yyyy-MM-dd` in the user's local calendar (for HTML date inputs and API fields).
 * `sv-SE` + numeric year/month/day yields ISO-like ordering in modern engines.
 */
export function formatLocalDateWire(d: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 24-hour local time for booking fields. */
export function formatLocalTime24(d: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatWeekdayShort(d: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { weekday: "short" }).format(d);
}

export function formatWeekRangeLabel(
  weekStart: Date,
  weekEndExclusive: Date,
): string {
  const lastDay = new Date(weekEndExclusive);
  lastDay.setDate(lastDay.getDate() - 1);
  const fmt = new Intl.DateTimeFormat(APP_LOCALE, {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(weekStart)}–${fmt.format(lastDay)}`;
}
