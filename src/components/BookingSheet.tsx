import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import type {
  CreateBookingRequest,
  MyBooking,
  Room,
  RoomWithReservations,
} from "../client/types.gen";
import { findAbRoomCompanion } from "../lib/abRoomPair";
import {
  clampNum,
  clampToFreeGaps,
  dayDisplayBounds,
  DURATION_CHIPS_MIN,
  isLocalStartInPast,
  MAX_BOOK_DURATION_MIN,
  MIN_BOOK_DURATION_MIN,
} from "../lib/bookingSheetMath";
import { errorMessage } from "../lib/errors";
import { useClampBookingToFreeGaps } from "../hooks/useClampBookingToFreeGaps";
import { useEscapeKey } from "../hooks/useUiEffects";
import { mergeIntervals } from "../lib/timeline/intervals";
import {
  formatLocalDate,
  formatLocalTime,
  formatCreateBookingInterval,
  freeSlotsInWindow,
  intervalToPercent,
  isMyCalendarBusy,
  parseApiInterval,
  parseInstantOnDate,
  QUARTER_HOUR_MS,
  snapInstantMsToQuarterOnDate,
  type TimeInterval,
} from "../lib/weekTimeline";
import { Button } from "./ui/Button";

type DragKind = "move" | "resize-start" | "resize-end";

export type BookingSheetInitial = {
  roomId: string;
  roomName?: string;
  /** When set, dual-room mode starts enabled (e.g. reopened draft). */
  companionRoomId?: string;
  companionRoomName?: string;
  date: string;
  startTime: string;
  endTime: string;
};

type BusyClipped = {
  start: Date;
  end: Date;
  label?: string;
  reservationId?: string;
};

function busyClippedForRoom(
  scheduleRooms: RoomWithReservations[] | undefined,
  forRoomId: string,
  displayStart: Date,
  displayEnd: Date,
): BusyClipped[] {
  const slots = scheduleRooms?.find((r) => r.id === forRoomId)?.bookings ?? [];
  return slots
    .map((slot) => {
      const { start: a, end: b } = parseApiInterval(slot.interval);
      const t0 = Math.max(a.getTime(), displayStart.getTime());
      const t1 = Math.min(b.getTime(), displayEnd.getTime());
      if (t1 <= t0) return null;
      return {
        start: new Date(t0),
        end: new Date(t1),
        label: slot.label,
        reservationId: slot.id,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function BookingSheetForm({
  initial,
  allRooms,
  scheduleRooms,
  myBookings,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  initial: BookingSheetInitial;
  allRooms: Room[] | undefined;
  scheduleRooms: RoomWithReservations[] | undefined;
  myBookings: MyBooking[] | undefined;
  onClose: () => void;
  onSubmit: (
    primary: CreateBookingRequest,
    companion?: CreateBookingRequest,
  ) => void;
  isPending: boolean;
  error: unknown | null;
}) {
  const { t } = useTranslation();
  const [roomId, setRoomId] = useState(initial.roomId);
  const roomName = initial.roomName ?? "";
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [title, setTitle] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [bookCompanion, setBookCompanion] = useState(
    () => Boolean(initial.companionRoomId),
  );
  const minBookDate = formatLocalDate(new Date());

  const primaryRoom = useMemo(
    () => allRooms?.find((r) => r.id === initial.roomId),
    [allRooms, initial.roomId],
  );

  const companionFromList = useMemo(
    () =>
      primaryRoom ? findAbRoomCompanion(primaryRoom, allRooms) : null,
    [primaryRoom, allRooms],
  );

  const companionRoom = useMemo((): Room | null => {
    if (initial.companionRoomId && initial.companionRoomName) {
      return {
        id: initial.companionRoomId,
        name: initial.companionRoomName,
        capacity: companionFromList?.capacity ?? null,
        equipment: companionFromList?.equipment ?? "",
        campus: companionFromList?.campus ?? "",
      };
    }
    return companionFromList;
  }, [
    companionFromList,
    initial.companionRoomId,
    initial.companionRoomName,
  ]);

  const companionInSchedule =
    companionRoom != null &&
    Boolean(scheduleRooms?.some((r) => r.id === companionRoom.id));

  const bookBothHalves =
    companionRoom != null && bookCompanion && companionInSchedule;

  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: DragKind;
    originX: number;
    startMs: number;
    endMs: number;
    pointerId: number;
  } | null>(null);

  const { start: displayStart, end: displayEnd } = dayDisplayBounds(date);

  const busyPrimary = useMemo(
    () => busyClippedForRoom(scheduleRooms, roomId, displayStart, displayEnd),
    [scheduleRooms, roomId, displayStart, displayEnd],
  );

  const busySecondary = useMemo(() => {
    if (!bookBothHalves || !companionRoom) return [];
    return busyClippedForRoom(
      scheduleRooms,
      companionRoom.id,
      displayStart,
      displayEnd,
    );
  }, [bookBothHalves, companionRoom, scheduleRooms, displayStart, displayEnd]);

  const busyForConstraints: TimeInterval[] = useMemo(() => {
    if (!bookBothHalves) {
      return busyPrimary.map((b) => ({ start: b.start, end: b.end }));
    }
    return mergeIntervals([
      ...busyPrimary.map((b) => ({ start: b.start, end: b.end })),
      ...busySecondary.map((b) => ({ start: b.start, end: b.end })),
    ]);
  }, [bookBothHalves, busyPrimary, busySecondary]);

  const freeGaps = useMemo(
    () => freeSlotsInWindow(displayStart, displayEnd, busyForConstraints),
    [displayStart, displayEnd, busyForConstraints],
  );

  const freeGapsLayoutKey = useMemo(
    () => freeGaps.map((g) => `${+g.start}-${+g.end}`).join("|"),
    [freeGaps],
  );

  const clearClientError = () => setClientError(null);

  useClampBookingToFreeGaps(
    date,
    roomId,
    freeGaps,
    freeGapsLayoutKey,
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    clearClientError,
  );

  useEscapeKey(onClose);

  useLayoutEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function applyIntervalClamped(startMs: number, endMs: number) {
    clearClientError();
    const [s2, e2] = clampToFreeGaps(startMs, endMs, freeGaps, date);
    setStartTime(formatLocalTime(new Date(s2)));
    setEndTime(formatLocalTime(new Date(e2)));
  }

  function commitManualTimes() {
    clearClientError();
    const s = parseInstantOnDate(date, startTime).getTime();
    let e = parseInstantOnDate(date, endTime).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return;
    if (e <= s) e = s + MIN_BOOK_DURATION_MIN * 60_000;
    const d = (e - s) / 60_000;
    if (d < MIN_BOOK_DURATION_MIN) e = s + MIN_BOOK_DURATION_MIN * 60_000;
    else if (d > MAX_BOOK_DURATION_MIN) e = s + MAX_BOOK_DURATION_MIN * 60_000;
    applyIntervalClamped(s, e);
  }

  const bookingInterval = {
    start: parseInstantOnDate(date, startTime),
    end: parseInstantOnDate(date, endTime),
  };

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

  function applyDurationFromStart(minutes: number) {
    const m = clampNum(minutes, MIN_BOOK_DURATION_MIN, MAX_BOOK_DURATION_MIN);
    const startMs = parseInstantOnDate(date, startTime).getTime();
    applyIntervalClamped(startMs, startMs + m * 60_000);
  }

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

  function placeBookingAtTrackClick(clientX: number) {
    clearClientError();
    const m = trackMetrics();
    if (!m) return;
    const w0 = displayStart.getTime();
    const w1 = displayEnd.getTime();
    const clickMs = snapInstantMsToQuarterOnDate(clientXToMs(clientX), date);
    const durMs =
      bookingInterval.end.getTime() - bookingInterval.start.getTime();
    if (durMs < MIN_BOOK_DURATION_MIN * 60_000) return;
    let startMs = snapInstantMsToQuarterOnDate(clickMs - durMs / 2, date);
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
    const [a, b] = clampToFreeGaps(startMs, endMs, freeGaps, date);
    setStartTime(formatLocalTime(new Date(a)));
    setEndTime(formatLocalTime(new Date(b)));
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
      clearClientError();
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
        startMsN = snapInstantMsToQuarterOnDate(d.startMs + deltaMs, date);
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
          date,
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
          date,
        );
        const lo = startFixed + MIN_BOOK_DURATION_MIN * 60_000;
        const hi = Math.min(w1, startFixed + MAX_BOOK_DURATION_MIN * 60_000);
        newEnd = clampNum(newEnd, lo, hi);
        startMsN = startFixed;
        endMsN = newEnd;
      }

      const [a, b] = clampToFreeGaps(startMsN, endMsN, freeGaps, date);
      setStartTime(formatLocalTime(new Date(a)));
      setEndTime(formatLocalTime(new Date(b)));
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

  const inputClass =
    "min-w-0 max-w-full w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2 text-base text-te-text outline-none transition-shadow placeholder:text-te-muted/70 focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:text-sm";

  const busyAtClick = useMemo(() => {
    if (!bookBothHalves) return busyPrimary;
    return [...busyPrimary, ...busySecondary];
  }, [bookBothHalves, busyPrimary, busySecondary]);

  function renderBusyLayer(
    busy: BusyClipped[],
    forRoomId: string,
    zBase: number,
  ) {
    return busy.map((b, i) => {
      const { leftPct: bl, widthPct: bw } = intervalToPercent(
        { start: b.start, end: b.end },
        displayStart,
        displayEnd,
      );
      const mine = isMyCalendarBusy(b, forRoomId, myBookings);
      const slotTitle = mine
        ? b.label
          ? t("booking.slotTitleMineLabeled", { label: b.label })
          : t("booking.slotTitleMine")
        : b.label
          ? t("booking.slotTitleBusyLabeled", { label: b.label })
          : t("booking.slotTitleBusy");
      return (
        <div
          key={`${forRoomId}-busy-${b.start.getTime()}-${i}`}
          title={slotTitle}
          className={`absolute top-4 bottom-1 flex items-center justify-center overflow-hidden rounded-sm px-0.5 shadow-inner ${
            mine ? "bg-te-mine-busy/85" : "bg-te-busy-strong/85"
          }`}
          style={{
            left: `${bl}%`,
            width: `${Math.max(bw, 0.5)}%`,
            zIndex: zBase,
          }}
        >
          {b.label && (
            <span
              className={`font-display truncate text-center text-[0.55rem] leading-tight font-semibold sm:text-[0.6rem] ${
                mine ? "text-te-mine-busy-text" : "text-white drop-shadow-sm"
              }`}
            >
              {b.label}
            </span>
          )}
        </div>
      );
    });
  }

  return (
    <div
      className="fixed inset-0 z-100 flex min-h-0 items-end justify-center overflow-x-hidden overflow-y-auto sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="bg-te-text/35 absolute inset-0"
        aria-hidden
        onPointerDown={(e) => {
          if (e.button === 0) onClose();
        }}
      />
      <div
        className="border-te-border bg-te-surface relative z-10 mt-auto flex max-h-[min(92vh,760px)] w-full max-w-[min(32rem,100dvw)] min-w-0 flex-col overflow-x-hidden rounded-t-2xl border shadow-2xl sm:mt-0 sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-sheet-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-te-border flex min-w-0 items-start justify-between gap-4 border-b py-4 pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]">
          <div className="min-w-0 flex-1">
            <h2
              id="booking-sheet-title"
              className="font-display text-te-text text-lg font-semibold tracking-tight"
            >
              {t("booking.newBooking")}
            </h2>
            {roomName && (
              <p
                className="text-te-muted mt-0.5 truncate text-sm"
                title={roomName}
              >
                {roomName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-te-muted hover:bg-te-accent-muted hover:text-te-text focus-visible:outline-te-accent rounded-lg p-1.5 focus-visible:outline-2"
            aria-label={t("booking.close")}
          >
            ✕
          </button>
        </div>

        <form
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto py-4 pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]"
          onSubmit={(e) => {
            e.preventDefault();
            clearClientError();
            let sMs = parseInstantOnDate(date, startTime).getTime();
            let eMs = parseInstantOnDate(date, endTime).getTime();
            if (!Number.isFinite(sMs) || !Number.isFinite(eMs)) {
              setClientError(t("booking.invalidTimes"));
              return;
            }
            sMs = snapInstantMsToQuarterOnDate(sMs, date);
            eMs = snapInstantMsToQuarterOnDate(eMs, date);
            let durMs = eMs - sMs;
            durMs = Math.max(
              MIN_BOOK_DURATION_MIN * 60_000,
              Math.round(durMs / QUARTER_HOUR_MS) * QUARTER_HOUR_MS,
            );
            durMs = Math.min(durMs, MAX_BOOK_DURATION_MIN * 60_000);
            eMs = sMs + durMs;
            const startNorm = formatLocalTime(new Date(sMs));
            const endNorm = formatLocalTime(new Date(eMs));
            if (isLocalStartInPast(date, startNorm, new Date())) {
              setClientError(t("booking.startInPast"));
              return;
            }
            const interval = formatCreateBookingInterval(
              date,
              startNorm,
              endNorm,
            );
            const titleOpt = title.trim() || undefined;
            const primaryBody: CreateBookingRequest = {
              roomId,
              interval,
              title: titleOpt,
            };
            if (bookBothHalves && companionRoom) {
              onSubmit(primaryBody, {
                roomId: companionRoom.id,
                interval,
                title: titleOpt,
              });
              return;
            }
            onSubmit(primaryBody);
          }}
        >
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="text-te-text font-medium">
                {t("booking.title")}
              </span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("booking.titlePlaceholder")}
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="text-te-text font-medium">
                {t("booking.date")}
              </span>
              <input
                className={inputClass}
                type="date"
                value={date}
                min={minBookDate}
                onChange={(e) => {
                  clearClientError();
                  setDate(e.target.value);
                }}
                required
              />
            </label>
          </div>

          {companionRoom && (
            <label className="flex cursor-pointer items-start gap-3 select-none">
              <input
                type="checkbox"
                className="border-te-border text-te-accent focus:ring-te-accent/30 mt-1 size-4 shrink-0 rounded"
                checked={bookCompanion}
                onChange={(e) => {
                  clearClientError();
                  setBookCompanion(e.target.checked);
                }}
              />
              <span className="text-te-text min-w-0 text-sm leading-snug">
                <span className="font-medium">
                  {t("booking.bookOtherHalf", { name: companionRoom.name })}
                </span>
                {bookCompanion && !companionInSchedule && (
                  <span className="text-te-muted mt-1 block text-xs">
                    {t("booking.companionScheduleMissing")}
                  </span>
                )}
              </span>
            </label>
          )}

          <section
            className="space-y-2"
            aria-label={t("booking.previewAria")}
          >
            <div
              className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2"
              aria-live="polite"
            >
              <span className="text-te-muted shrink-0 text-xs font-semibold tracking-[0.12em] uppercase">
                {t("booking.time")}
              </span>
              <span className="break-anywhere text-te-text min-w-0 font-mono text-xs tabular-nums sm:text-right">
                {startTime}–{endTime}
                <span className="text-te-muted ml-2">
                  {t("booking.minutesSuffix", { count: durationMin })}
                </span>
              </span>
            </div>
            <div
              ref={trackRef}
              className="relative h-11 min-h-11 w-full cursor-default overflow-visible"
              onPointerDownCapture={(e) => {
                if (e.button !== 0) return;
                const t = e.target as HTMLElement | null;
                if (!t) return;
                if (t.closest("[data-booking-preview-root]")) return;
                const clicked = snapInstantMsToQuarterOnDate(
                  clientXToMs(e.clientX),
                  date,
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
                placeBookingAtTrackClick(e.clientX);
              }}
            >
              <div className="bg-te-border/25 pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                <div className="text-te-muted/80 absolute inset-x-0 top-0 flex justify-between px-1 pt-1 text-[9px] font-medium tracking-wider uppercase">
                  <span>07</span>
                  <span>13</span>
                  <span>22</span>
                </div>
                {renderBusyLayer(busyPrimary, roomId, 1)}
              </div>
              <div
                data-booking-preview-root
                className="absolute top-4 bottom-1 z-10"
                style={{
                  left: `${leftPct}%`,
                  width: `${previewWidthPct}%`,
                }}
              >
                <button
                  type="button"
                  aria-label={t("booking.adjustStart")}
                  className="absolute top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-manipulation items-center justify-end bg-transparent pr-px"
                  style={{ right: "100%" }}
                  onPointerDown={(e) => onPointerDownBar("resize-start", e)}
                >
                  <span className="bg-te-accent pointer-events-none h-[62%] w-px rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" />
                </button>
                <div
                  className="te-booking-preview-bar border-te-accent/35 bg-te-free-hover flex h-full min-h-0 w-full min-w-0 cursor-grab touch-manipulation items-center justify-center rounded-md border px-1 select-none active:cursor-grabbing"
                  onPointerDown={(e) => onPointerDownBar("move", e)}
                  aria-label={
                    title.trim()
                      ? t("booking.previewGrabTitle", {
                          title: title.trim(),
                        })
                      : t("booking.previewGrabNoTitle")
                  }
                >
                  {title.trim() && (
                    <span className="font-display text-te-accent pointer-events-none truncate text-center text-[0.6rem] leading-tight font-semibold tracking-tight drop-shadow-sm sm:text-[0.68rem] sm:leading-tight">
                      {title.trim()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t("booking.adjustEnd")}
                  className="absolute top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-manipulation items-center justify-start bg-transparent pl-px"
                  style={{ left: "100%" }}
                  onPointerDown={(e) => onPointerDownBar("resize-end", e)}
                >
                  <span className="bg-te-accent pointer-events-none h-[62%] w-px rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" />
                </button>
              </div>
            </div>

            {bookBothHalves && companionRoom && (
              <div className="space-y-1 pt-1">
                <p className="text-te-muted text-xs font-medium">
                  {companionRoom.name}
                </p>
                <div className="relative h-11 min-h-11 w-full overflow-hidden rounded-lg">
                  <div className="bg-te-border/25 pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                    <div className="text-te-muted/80 absolute inset-x-0 top-0 flex justify-between px-1 pt-1 text-[9px] font-medium tracking-wider uppercase">
                      <span>07</span>
                      <span>13</span>
                      <span>22</span>
                    </div>
                    {renderBusyLayer(
                      busySecondary,
                      companionRoom.id,
                      1,
                    )}
                  </div>
                  <div
                    className="border-te-accent/40 pointer-events-none absolute top-4 bottom-1 z-10 rounded-md border border-dashed"
                    style={{
                      left: `${leftPct}%`,
                      width: `${previewWidthPct}%`,
                    }}
                    aria-hidden
                  />
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-2">
            <span className="text-te-text text-sm font-medium">
              {t("booking.durationPresets")}
            </span>
            <div className="flex flex-wrap gap-2">
              {DURATION_CHIPS_MIN.map((m) => {
                const active = durationMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-te-accent bg-te-accent-muted text-te-accent"
                        : "border-te-border text-te-muted hover:border-te-accent/50"
                    }`}
                    onClick={() => applyDurationFromStart(m)}
                  >
                    {m} min
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="text-te-text font-medium">
                {t("booking.startTime")}
              </span>
              <input
                className={inputClass + " font-mono text-base sm:text-xs"}
                value={startTime}
                onChange={(e) => {
                  clearClientError();
                  setStartTime(e.target.value);
                }}
                onBlur={commitManualTimes}
                placeholder="09:00"
                required
                aria-label={t("booking.startTimeAria")}
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span className="text-te-text font-medium">
                {t("booking.endTime")}
              </span>
              <input
                className={inputClass + " font-mono text-base sm:text-xs"}
                value={endTime}
                onChange={(e) => {
                  clearClientError();
                  setEndTime(e.target.value);
                }}
                onBlur={commitManualTimes}
                required
                aria-label={t("booking.endTimeAria")}
              />
            </label>
          </div>

          <div className="border-te-border border-t pt-3">
            <button
              type="button"
              className="text-te-accent text-xs font-medium hover:underline"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              {showAdvanced ? t("booking.hide") : t("booking.showRoomId")}
            </button>
            {showAdvanced && (
              <label className="mt-2 grid min-w-0 gap-1 text-sm">
                <span className="text-te-muted">{t("booking.roomIdApi")}</span>
                <input
                  className={inputClass + " font-mono text-base sm:text-xs"}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                />
              </label>
            )}
          </div>

          {clientError && (
            <p className="text-te-danger text-sm" role="alert">
              {clientError}
            </p>
          )}
          {!!error && (
            <p
              className="text-te-danger text-sm"
              role="alert"
              aria-live="polite"
            >
              {errorMessage(error)}
            </p>
          )}

          <div className="border-te-border mt-auto flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("booking.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("booking.creating") : t("booking.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BookingSheet({
  open,
  onClose,
  initial,
  allRooms,
  scheduleRooms,
  myBookings,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  initial: BookingSheetInitial | null;
  allRooms: Room[] | undefined;
  scheduleRooms: RoomWithReservations[] | undefined;
  myBookings: MyBooking[] | undefined;
  onSubmit: (
    primary: CreateBookingRequest,
    companion?: CreateBookingRequest,
  ) => void;
  isPending: boolean;
  error: unknown | null;
}) {
  if (!open || !initial || typeof document === "undefined") return null;

  return createPortal(
    <BookingSheetForm
      key={`${initial.roomId}-${initial.date}-${initial.startTime}-${initial.endTime}`}
      initial={initial}
      allRooms={allRooms}
      scheduleRooms={scheduleRooms}
      myBookings={myBookings}
      onClose={onClose}
      onSubmit={onSubmit}
      isPending={isPending}
      error={error}
    />,
    document.body,
  );
}
