import { useEffect } from "react";
import { clampToFreeGaps, intervalFitsInFreeGaps } from "../lib/bookingSheetMath";
import { formatLocalTime, parseInstantOnDate, type TimeInterval } from "../lib/weekTimeline";

/**
 * When the schedule grid changes (room/day), re-clamp the draft interval so it stays inside free gaps.
 * Intentionally ignores `startTime`/`endTime` in deps so manual typing does not fight the sync.
 */
export function useClampBookingToFreeGaps(
  date: string,
  roomId: string,
  freeGaps: TimeInterval[],
  freeGapsLayoutKey: string,
  startTime: string,
  endTime: string,
  setStartTime: (v: string) => void,
  setEndTime: (v: string) => void,
  /** Fires when times are auto-adjusted (e.g. clear field-level validation state). */
  onReconciled?: () => void,
) {
  useEffect(() => {
    if (freeGaps.length === 0) return;
    const s = parseInstantOnDate(date, startTime).getTime();
    const e = parseInstantOnDate(date, endTime).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return;
    if (intervalFitsInFreeGaps(s, e, freeGaps)) return;
    const [s2, e2] = clampToFreeGaps(s, e, freeGaps, date);
    const ns = formatLocalTime(new Date(s2));
    const ne = formatLocalTime(new Date(e2));
    if (ns !== startTime || ne !== endTime) {
      onReconciled?.();
      setStartTime(ns);
      setEndTime(ne);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when grid identity changes
  }, [date, roomId, freeGapsLayoutKey]);
}
