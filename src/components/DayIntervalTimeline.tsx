import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MyBooking } from "../client/types.gen";
import {
  clampIntervalToDayWindow,
  clampNum,
  clampToFreeGaps,
  dayDisplayBounds,
  MAX_BOOK_DURATION_MIN,
  MIN_BOOK_DURATION_MIN,
} from "../lib/bookingSheetMath";
import {
  formatLocalTime,
  intervalToPercent,
  isMyCalendarBusy,
  parseInstantOnDate,
  snapInstantMsToQuarterOnDate,
  type TimeInterval,
} from "../lib/weekTimeline";

type DragKind = "move" | "resize-start" | "resize-end";

export type DayIntervalBusySegment = {
  start: Date;
  end: Date;
  label?: string;
  reservationId?: string;
};

type DayIntervalTimelineProps = {
  dateStr: string;
  startTime: string;
  endTime: string;
  onIntervalChange: (next: { startTime: string; endTime: string }) => void;
  /** Busy blocks on the track (already clipped to the visible window). */
  busySegments: DayIntervalBusySegment[];
  /** Room id for “mine” styling when matching myBookings */
  roomIdForMineCheck: string;
  myBookings?: MyBooking[] | undefined;
  /**
   * When set, interval snaps/clamps to these free gaps (booking modal).
   * When omitted, only the visible day window is used (rooms filter).
   */
  freeGaps?: TimeInterval[];
  /** Optional label in the draggable bar center */
  barLabel?: string;
  /** Center content in the bar (overrides barLabel if set) */
  barContent?: ReactNode;
  /** Section aria-label (omit wrapper when undefined) */
  sectionAriaLabel?: string;
  /** Summary row: left label (e.g. “Time”). Omit for times-only row. */
  summaryLeftLabel?: string;
  /** When false, clicking empty track does nothing */
  clickToReposition?: boolean;
  /** aria-label for the draggable bar (move). Defaults to title-based booking strings. */
  barGrabAriaLabel?: string;
  /** Busy blocks + click blocking on busy (booking sheet). */
  showBusyOverlay?: boolean;
  /** Hour markers (07 / 13 / 22) above the track */
  showTrackLabels?: boolean;
  /** Entire summary row (times + duration) hidden */
  hideSummaryRow?: boolean;
  /** Non-interactive (e.g. filter off); hides pointer/drag affordances */
  disabled?: boolean;
};

export function DayIntervalTimeline({
  dateStr,
  startTime,
  endTime,
  onIntervalChange,
  busySegments,
  roomIdForMineCheck,
  myBookings,
  freeGaps,
  barLabel,
  barContent,
  sectionAriaLabel,
  summaryLeftLabel,
  clickToReposition = true,
  barGrabAriaLabel,
  showBusyOverlay = true,
  showTrackLabels = true,
  hideSummaryRow = false,
  disabled = false,
}: DayIntervalTimelineProps) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: DragKind;
    originX: number;
    startMs: number;
    endMs: number;
    pointerId: number;
  } | null>(null);

  const { start: displayStart, end: displayEnd } = dayDisplayBounds(dateStr);

  const applyInterval = (startMs: number, endMs: number) => {
    if (disabled) return;
    const [a, b] =
      freeGaps != null
        ? clampToFreeGaps(startMs, endMs, freeGaps, dateStr)
        : clampIntervalToDayWindow(
            startMs,
            endMs,
            dateStr,
            displayStart,
            displayEnd,
          );
    const st = formatLocalTime(new Date(a));
    const et = formatLocalTime(new Date(b));
    onIntervalChange({ startTime: st, endTime: et });
  };

  const bookingInterval = useMemo(
    () => ({
      start: parseInstantOnDate(dateStr, startTime),
      end: parseInstantOnDate(dateStr, endTime),
    }),
    [dateStr, startTime, endTime],
  );

  const durationMin = Math.max(
    0,
    Math.round(
      (bookingInterval.end.getTime() - bookingInterval.start.getTime()) /
        60_000,
    ),
  );

  const { leftPct, widthPct } = intervalToPercent(
    bookingInterval,
    displayStart,
    displayEnd,
  );
  const previewWidthPct = widthPct > 0 ? Math.max(widthPct, 1.2) : 0;

  function trackMetrics() {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const spanMs = displayEnd.getTime() - displayStart.getTime();
    if (spanMs <= 0) return null;
    return { el, rect, spanMs };
  }

  function clientXToMs(clientX: number) {
    const m = trackMetrics();
    if (!m) return displayStart.getTime();
    const ratio = clampNum((clientX - m.rect.left) / m.rect.width, 0, 1);
    return displayStart.getTime() + ratio * m.spanMs;
  }

  function placeAtTrackClick(clientX: number) {
    const m = trackMetrics();
    if (!m) return;
    const w0 = displayStart.getTime();
    const w1 = displayEnd.getTime();
    const clickMs = snapInstantMsToQuarterOnDate(clientXToMs(clientX), dateStr);
    const durMs =
      bookingInterval.end.getTime() - bookingInterval.start.getTime();
    if (durMs < MIN_BOOK_DURATION_MIN * 60_000) return;
    let startMs = snapInstantMsToQuarterOnDate(clickMs - durMs / 2, dateStr);
    let endMs = startMs + durMs;
    if (endMs > w1) {
      const over = endMs - w1;
      startMs -= over;
      endMs = w1;
    }
    if (startMs < w0) {
      const under = w0 - startMs;
      startMs = w0;
      endMs += under;
    }
    if (endMs > w1) endMs = w1;
    if ((endMs - startMs) / 60_000 < MIN_BOOK_DURATION_MIN) return;
    applyInterval(startMs, endMs);
  }

  function endDragPointer() {
    const d = dragRef.current;
    if (!d) return;
    const el = trackRef.current;
    if (el) {
      try {
        el.releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  }

  function onPointerDownBar(kind: DragKind, e: ReactPointerEvent) {
    if (disabled) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startMs = bookingInterval.start.getTime();
    const endMs = bookingInterval.end.getTime();
    dragRef.current = {
      kind,
      originX: e.clientX,
      startMs,
      endMs,
      pointerId: e.pointerId,
    };
    const el = trackRef.current;
    if (el) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const m = trackMetrics();
      if (!m) return;

      const w0 = displayStart.getTime();
      const w1 = displayEnd.getTime();
      const durMs = d.endMs - d.startMs;
      let startMsN = d.startMs;
      let endMsN = d.endMs;

      if (d.kind === "move") {
        const dxRatio = (ev.clientX - d.originX) / m.rect.width;
        const deltaMs = dxRatio * m.spanMs;
        startMsN = snapInstantMsToQuarterOnDate(d.startMs + deltaMs, dateStr);
        endMsN = startMsN + durMs;
        if (endMsN > w1) {
          const over = endMsN - w1;
          startMsN -= over;
          endMsN = w1;
        }
        if (startMsN < w0) {
          const under = w0 - startMsN;
          startMsN = w0;
          endMsN += under;
        }
        if (endMsN > w1) endMsN = w1;
        const durMinNow = (endMsN - startMsN) / 60_000;
        if (durMinNow < MIN_BOOK_DURATION_MIN) {
          startMsN = d.startMs;
          endMsN = d.endMs;
        }
      } else if (d.kind === "resize-start") {
        const endFixed = d.endMs;
        let newStart = snapInstantMsToQuarterOnDate(
          clientXToMs(ev.clientX),
          dateStr,
        );
        const lo = Math.max(w0, endFixed - MAX_BOOK_DURATION_MIN * 60_000);
        const hi = endFixed - MIN_BOOK_DURATION_MIN * 60_000;
        newStart = clampNum(newStart, lo, hi);
        startMsN = newStart;
        endMsN = endFixed;
      } else {
        const startFixed = d.startMs;
        let newEnd = snapInstantMsToQuarterOnDate(
          clientXToMs(ev.clientX),
          dateStr,
        );
        const lo = startFixed + MIN_BOOK_DURATION_MIN * 60_000;
        const hi = Math.min(w1, startFixed + MAX_BOOK_DURATION_MIN * 60_000);
        newEnd = clampNum(newEnd, lo, hi);
        startMsN = startFixed;
        endMsN = newEnd;
      }

      applyInterval(startMsN, endMsN);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      endDragPointer();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const busyAtClick = showBusyOverlay ? busySegments : [];
  const trackBarInset = showTrackLabels
    ? "top-4 bottom-1"
    : "top-1 bottom-1";

  return (
    <section
      className={`space-y-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}
      aria-label={sectionAriaLabel ?? undefined}
      aria-disabled={disabled || undefined}
    >
      {!hideSummaryRow && (
        <div
          className={`flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:gap-2 ${
            summaryLeftLabel ? "sm:justify-between" : "sm:justify-end"
          }`}
          aria-live="polite"
        >
          {summaryLeftLabel ? (
            <span className="text-te-muted shrink-0 text-xs font-semibold tracking-[0.12em] uppercase">
              {summaryLeftLabel}
            </span>
          ) : null}
          <span className="break-anywhere text-te-text min-w-0 font-mono text-xs tabular-nums sm:text-right">
            {startTime}–{endTime}
            <span className="text-te-muted ml-2">
              {t("booking.minutesSuffix", { count: durationMin })}
            </span>
          </span>
        </div>
      )}
      <div
        ref={trackRef}
        className="relative h-11 min-h-11 w-full cursor-default overflow-visible"
        onPointerDownCapture={(e) => {
          if (disabled) return;
          if (!clickToReposition) return;
          if (e.button !== 0) return;
          const tgt = e.target as HTMLElement | null;
          if (!tgt) return;
          if (tgt.closest("[data-day-interval-preview-root]")) return;
          const clicked = snapInstantMsToQuarterOnDate(
            clientXToMs(e.clientX),
            dateStr,
          );
          if (
            busyAtClick.some(
              (b) =>
                clicked >= b.start.getTime() && clicked < b.end.getTime(),
            )
          ) {
            return;
          }
          e.preventDefault();
          placeAtTrackClick(e.clientX);
        }}
      >
        <div className="bg-te-border/25 pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          {showTrackLabels && (
            <div className="text-te-muted/80 absolute inset-x-0 top-0 flex justify-between px-1 pt-1 text-[9px] font-medium tracking-wider uppercase">
              <span>07</span>
              <span>13</span>
              <span>22</span>
            </div>
          )}
          {showBusyOverlay &&
            busySegments.map((b, i) => {
              const { leftPct: bl, widthPct: bw } = intervalToPercent(
                { start: b.start, end: b.end },
                displayStart,
                displayEnd,
              );
              const mine = isMyCalendarBusy(b, roomIdForMineCheck, myBookings);
              const slotTitle = mine
                ? b.label
                  ? t("booking.slotTitleMineLabeled", { label: b.label })
                  : t("booking.slotTitleMine")
                : b.label
                  ? t("booking.slotTitleBusyLabeled", { label: b.label })
                  : t("booking.slotTitleBusy");
              return (
                <div
                  key={`busy-${b.start.getTime()}-${i}`}
                  title={slotTitle}
                  className={`absolute ${trackBarInset} flex items-center justify-center overflow-hidden rounded-sm px-0.5 shadow-inner ${
                    mine ? "bg-te-mine-busy/85" : "bg-te-busy-strong/85"
                  }`}
                  style={{
                    left: `${bl}%`,
                    width: `${Math.max(bw, 0.5)}%`,
                    zIndex: 1,
                  }}
                >
                  {b.label && (
                    <span
                      className={`font-display truncate text-center text-[0.55rem] leading-tight font-semibold sm:text-[0.6rem] ${
                        mine
                          ? "text-te-mine-busy-text"
                          : "text-white drop-shadow-sm"
                      }`}
                    >
                      {b.label}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
        <div
          data-day-interval-preview-root
          className={`absolute z-10 ${trackBarInset}`}
          style={{
            left: `${leftPct}%`,
            width: `${previewWidthPct}%`,
          }}
        >
          <button
            type="button"
            disabled={disabled}
            aria-label={t("booking.adjustStart")}
            className="absolute top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-manipulation items-center justify-end bg-transparent pr-px disabled:cursor-not-allowed"
            style={{ right: "100%" }}
            onPointerDown={(e) => onPointerDownBar("resize-start", e)}
          >
            <span className="bg-te-accent pointer-events-none h-[62%] w-px rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" />
          </button>
          <div
            className="te-booking-preview-bar border-te-accent/35 bg-te-free-hover flex h-full min-h-0 w-full min-w-0 cursor-grab touch-manipulation items-center justify-center rounded-md border px-1 select-none active:cursor-grabbing"
            onPointerDown={(e) => onPointerDownBar("move", e)}
            aria-label={
              barGrabAriaLabel ??
              (barLabel?.trim()
                ? t("booking.previewGrabTitle", { title: barLabel.trim() })
                : t("booking.previewGrabNoTitle"))
            }
          >
            {barContent ??
              (barLabel?.trim() ? (
                <span className="font-display text-te-accent pointer-events-none truncate text-center text-[0.6rem] leading-tight font-semibold tracking-tight drop-shadow-sm sm:text-[0.68rem] sm:leading-tight">
                  {barLabel.trim()}
                </span>
              ) : null)}
          </div>
          <button
            type="button"
            disabled={disabled}
            aria-label={t("booking.adjustEnd")}
            className="absolute top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-manipulation items-center justify-start bg-transparent pl-px disabled:cursor-not-allowed"
            style={{ left: "100%" }}
            onPointerDown={(e) => onPointerDownBar("resize-end", e)}
          >
            <span className="bg-te-accent pointer-events-none h-[62%] w-px rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" />
          </button>
        </div>
      </div>
    </section>
  );
}
