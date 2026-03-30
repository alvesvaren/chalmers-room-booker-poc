/**
 * Local noon when resolving `YYYY-MM-DD` to a `Date` for week / calendar arithmetic
 * (stays on the intended calendar day across DST).
 */
export const CALENDAR_INSTANT_ANCHOR_TIME = "12:00";

/** Local midnight on a calendar day (`HH:mm` for `parseInstantOnDate`). */
export const LOCAL_MIDNIGHT_TIME = "00:00";
