import { addMinutes as addMinutesDateFns } from "date-fns";
import { formatLocalDateWire, formatLocalTime24 } from "../datetime";
import type { TimeInterval } from "./types";
import {
  QUARTER_HOUR_MS,
  snapInstantMsToCeilQuarterOnDate,
  snapInstantMsToQuarterOnDate,
} from "./quarters";

export function addMinutes(d: Date, minutes: number): Date {
  return addMinutesDateFns(d, minutes);
}

/** Default booking length when opening the sheet (1 h, capped by gap end). */
export function defaultBookingWindow(gap: TimeInterval): TimeInterval {
  const oneHour = addMinutesDateFns(gap.start, 60);
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
  const dateStr = formatLocalDateWire(w.start);
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
    startTime: formatLocalTime24(new Date(startMs)),
    endTime: formatLocalTime24(new Date(endMs)),
  };
}
