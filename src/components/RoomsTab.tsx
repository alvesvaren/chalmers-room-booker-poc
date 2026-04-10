import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Room } from "../client/types.gen";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { compareRoomsForSort } from "../lib/roomSort";
import { appLocaleBcp47 } from "../lib/datetime/intlFormat";
import {
  clampIntervalToDayWindow,
  dayDisplayBounds,
  defaultAvailabilityFilterStartTime,
  DURATION_CHIPS_MIN,
} from "../lib/bookingSheetMath";
import { roomWithBookingsFor } from "../lib/roomSchedule";
import { getRoomRating } from "../lib/roomRatings";
import {
  addMinutes,
  formatLocalDate,
  formatLocalTime,
  formatWeekRangeLabel,
  parseInstantOnDate,
  roomAvailableForInterval,
} from "../lib/weekTimeline";
import { DayIntervalTimeline } from "./DayIntervalTimeline";
import { BookingRulesCallout } from "./BookingRulesCallout";
import { RoomFiltersCard } from "./RoomFiltersCard";
import { VirtualizedWindowGrid } from "./VirtualizedWindowGrid";
import type { RoomsTabProps } from "./workspaceTabProps";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Skeleton } from "./ui/Skeleton";

export function RoomsTab({
  data,
  status,
  filters,
  actions,
  isTabActive,
}: RoomsTabProps) {
  const {
    rooms,
    bookings,
    bookingsWeekStart,
    bookingsWeekEnd,
  } = data;
  const {
    roomsIsFetching,
    roomsUiStale,
    bookingsIsFetching,
    bookingsUiStale,
  } = status;
  const {
    qFilter,
    onQFilter,
    capacityBounds,
    capacityMin,
    capacityMax,
    onCapacityRangeChange,
    roomSort,
    onRoomSortChange,
  } = filters;
  const { onRoomsAvailabilityDateChange, onBookRoom, isRoomBookable } =
    actions;
  const { t } = useTranslation();
  const collatorLocale = appLocaleBcp47();
  const [slotFilterActive, setSlotFilterActive] = useState(false);
  const [slotDate, setSlotDate] = useState(() => formatLocalDate(new Date()));
  const [slotStartTime, setSlotStartTime] = useState(() =>
    defaultAvailabilityFilterStartTime(formatLocalDate(new Date())),
  );
  const [slotEndTime, setSlotEndTime] = useState(() => {
    const d = formatLocalDate(new Date());
    const st = defaultAvailabilityFilterStartTime(d);
    const { start: w0, end: w1 } = dayDisplayBounds(d);
    const sMs = parseInstantOnDate(d, st).getTime();
    const eMs = addMinutes(new Date(sMs), 120).getTime();
    const [, b] = clampIntervalToDayWindow(sMs, eMs, d, w0, w1);
    return formatLocalTime(new Date(b));
  });
  /** Debounced copy for list filtering (reduces work while dragging timeline). */
  const [slotAppliedStart, setSlotAppliedStart] = useState(slotStartTime);
  const [slotAppliedEnd, setSlotAppliedEnd] = useState(slotEndTime);

  const SLOT_FILTER_DEBOUNCE_MS = 200;

  useEffect(() => {
    if (!slotFilterActive) return undefined;
    const id = window.setTimeout(() => {
      setSlotAppliedStart(slotStartTime);
      setSlotAppliedEnd(slotEndTime);
    }, SLOT_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [slotFilterActive, slotStartTime, slotEndTime, slotDate]);

  const minBookDate = formatLocalDate(new Date());

  const applyDefaultSlotIntervalForDate = useCallback((dateStr: string) => {
    const st = defaultAvailabilityFilterStartTime(dateStr);
    const { start: w0, end: w1 } = dayDisplayBounds(dateStr);
    const sMs = parseInstantOnDate(dateStr, st).getTime();
    const eMs = addMinutes(new Date(sMs), 120).getTime();
    const [a, b] = clampIntervalToDayWindow(sMs, eMs, dateStr, w0, w1);
    const startStr = formatLocalTime(new Date(a));
    const endStr = formatLocalTime(new Date(b));
    setSlotStartTime(startStr);
    setSlotEndTime(endStr);
    setSlotAppliedStart(startStr);
    setSlotAppliedEnd(endStr);
  }, []);

  const setSlotFilterActiveSynced = useCallback(
    (checked: boolean) => {
      setSlotFilterActive(checked);
      if (checked) {
        applyDefaultSlotIntervalForDate(slotDate);
      } else {
        setSlotAppliedStart(slotStartTime);
        setSlotAppliedEnd(slotEndTime);
      }
      onRoomsAvailabilityDateChange(checked ? slotDate : null);
    },
    [
      applyDefaultSlotIntervalForDate,
      onRoomsAvailabilityDateChange,
      slotDate,
      slotStartTime,
      slotEndTime,
    ],
  );

  const setSlotDateSynced = useCallback(
    (nextDate: string) => {
      setSlotDate(nextDate);
      applyDefaultSlotIntervalForDate(nextDate);
      if (slotFilterActive) onRoomsAvailabilityDateChange(nextDate);
    },
    [
      applyDefaultSlotIntervalForDate,
      onRoomsAvailabilityDateChange,
      slotFilterActive,
    ],
  );

  const failedRoomIds = useMemo(() => {
    const e = bookings?.errors;
    if (!e?.length) return new Set<string>();
    return new Set(e.map((x) => x.roomId));
  }, [bookings?.errors]);

  const roomList = useMemo(() => rooms ?? [], [rooms]);

  const slotInterval = useMemo(() => {
    if (!slotFilterActive) return null;
    const start = parseInstantOnDate(slotDate, slotAppliedStart);
    const end = parseInstantOnDate(slotDate, slotAppliedEnd);
    const crossesDay =
      formatLocalDate(end) !== slotDate || end.getTime() <= start.getTime();
    return {
      start,
      end,
      endTime: formatLocalTime(end),
      crossesDay,
    };
  }, [slotFilterActive, slotDate, slotAppliedStart, slotAppliedEnd]);

  const crossesDayUi = useMemo(() => {
    if (!slotFilterActive) return false;
    const start = parseInstantOnDate(slotDate, slotStartTime);
    const end = parseInstantOnDate(slotDate, slotEndTime);
    return (
      formatLocalDate(end) !== slotDate || end.getTime() <= start.getTime()
    );
  }, [slotFilterActive, slotDate, slotStartTime, slotEndTime]);

  const roomSlotOk = useCallback(
    (room: Room): boolean => {
      if (!bookings) return false;
      if (!slotFilterActive || !slotInterval || slotInterval.crossesDay) {
        return false;
      }
      if (failedRoomIds.has(room.id)) return false;
      const rw = roomWithBookingsFor(room, bookings.rooms);
      return roomAvailableForInterval(
        rw,
        bookingsWeekStart,
        bookingsWeekEnd,
        slotDate,
        slotInterval.start,
        slotInterval.end,
      );
    },
    [
      bookings,
      slotFilterActive,
      slotInterval,
      failedRoomIds,
      bookingsWeekStart,
      bookingsWeekEnd,
      slotDate,
    ],
  );

  const canBookRoom = useCallback(
    (room: Room): boolean => {
      if (failedRoomIds.has(room.id)) return false;
      if (slotFilterActive) {
        if (!slotInterval || slotInterval.crossesDay) return false;
        return roomSlotOk(room);
      }
      return isRoomBookable(room);
    },
    [failedRoomIds, slotFilterActive, slotInterval, roomSlotOk, isRoomBookable],
  );

  const filtered = useMemo(() => {
    let list = [...roomList];
    const q = qFilter.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    list = list.filter((r) =>
      roomMatchesCapacityFilter(r, capacityMin, capacityMax),
    );
    if (slotFilterActive) {
      list = list.filter((r) => roomSlotOk(r));
    }
    list.sort((a, b) =>
      compareRoomsForSort(a, b, roomSort, collatorLocale),
    );
    return list;
  }, [
    roomList,
    qFilter,
    capacityMin,
    capacityMax,
    roomSort,
    slotFilterActive,
    roomSlotOk,
    collatorLocale,
  ]);

  const fieldClass =
    "box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-te-border bg-te-elevated px-3 text-base text-te-text outline-none transition-[box-shadow,background-color] focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:h-10 sm:text-sm";
  const roomGridClass =
    "grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]";

  const slotPanelClass =
    "rounded-2xl border border-te-accent/20 bg-gradient-to-br from-te-accent/[0.07] via-te-elevated to-te-surface p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5";

  const slotBookingsInitialLoad =
    slotFilterActive && bookings == null && bookingsIsFetching;
  const slotBookingsStaleUi =
    slotFilterActive && bookings != null && bookingsUiStale;

  const roomsLoadPending = rooms == null && roomsIsFetching;

  const roomGridStaleClass =
    roomsUiStale || slotBookingsStaleUi || bookingsUiStale
      ? "opacity-60 saturate-[0.85] transition-[opacity,filter] duration-150"
      : "";

  const bookingsWeekLabel = formatWeekRangeLabel(
    bookingsWeekStart,
    bookingsWeekEnd,
  );

  const freeAtTimePanel = (
    <div className={slotPanelClass}>
      <label className="flex cursor-pointer items-baseline gap-3 select-none">
        <Checkbox
          checked={slotFilterActive}
          onCheckedChange={(c) => setSlotFilterActiveSynced(c === true)}
        />
        <span className="font-display text-te-text text-sm font-semibold">
          {t("rooms.freeAtTime")}
        </span>
      </label>

      <fieldset
        disabled={!slotFilterActive}
        className="group border-te-border/60 mt-4 min-w-0 space-y-4 border-0 border-t p-0 pt-4"
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-te-muted font-medium">{t("rooms.day")}</span>
          <input
            type="date"
            className={`${fieldClass} group-disabled:cursor-not-allowed group-disabled:opacity-60`}
            min={minBookDate}
            value={slotDate}
            onChange={(e) => setSlotDateSynced(e.target.value)}
          />
        </label>
        <DayIntervalTimeline
          dateStr={slotDate}
          startTime={slotStartTime}
          endTime={slotEndTime}
          onIntervalChange={({ startTime: st, endTime: et }) => {
            setSlotStartTime(st);
            setSlotEndTime(et);
          }}
          busySegments={[]}
          roomIdForMineCheck=""
          sectionAriaLabel={t("rooms.slotFilterPreviewAria")}
          summaryLeftLabel=""
          showBusyOverlay={false}
          showTrackLabels={false}
          barGrabAriaLabel={t("rooms.slotFilterGrabAria")}
          disabled={!slotFilterActive}
        />
        <div>
          <span className="text-te-muted mb-2 block text-xs font-medium">
            {t("rooms.durationPresets")}
          </span>
          <div className="flex flex-wrap gap-2">
            {DURATION_CHIPS_MIN.map((m) => {
              const dur =
                (parseInstantOnDate(slotDate, slotEndTime).getTime() -
                  parseInstantOnDate(slotDate, slotStartTime).getTime()) /
                60_000;
              const active = Math.round(dur) === m;
              return (
                <button
                  key={m}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none ${
                    active
                      ? "border-te-accent bg-te-accent-muted text-te-accent group-disabled:border-te-border group-disabled:bg-te-elevated group-disabled:text-te-muted"
                      : "border-te-border text-te-muted enabled:hover:border-te-accent/40"
                  }`}
                  onClick={() => {
                    const { start: w0, end: w1 } = dayDisplayBounds(slotDate);
                    const sMs = parseInstantOnDate(
                      slotDate,
                      slotStartTime,
                    ).getTime();
                    const eMs = addMinutes(new Date(sMs), m).getTime();
                    const [a, b] = clampIntervalToDayWindow(
                      sMs,
                      eMs,
                      slotDate,
                      w0,
                      w1,
                    );
                    setSlotStartTime(formatLocalTime(new Date(a)));
                    setSlotEndTime(formatLocalTime(new Date(b)));
                  }}
                >
                  {m} min
                </button>
              );
            })}
          </div>
        </div>
        {crossesDayUi && (
          <p className="text-te-danger text-xs font-medium">
            {t("rooms.crossesMidnight")}
          </p>
        )}
      </fieldset>

      {slotBookingsInitialLoad && (
        <div
          className="border-te-border/60 mt-4 space-y-3 border-t pt-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="sr-only">
            {t("rooms.fetchingBookingsWeek", { week: bookingsWeekLabel })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-2.5 w-full max-w-40 rounded-full sm:max-w-56" />
            <Skeleton className="hidden h-2.5 w-16 rounded-full sm:block" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <h2 className="font-display text-te-text text-xl font-semibold">
        {t("rooms.heading")}
      </h2>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_minmax(17rem,22rem)] lg:items-start lg:gap-6">
        <div className="min-w-0">
          <RoomFiltersCard
            nameFieldId="rooms-search"
            nameLabel={t("rooms.name")}
            searchPlaceholder={t("rooms.searchPlaceholder")}
            searchValue={qFilter}
            onSearchChange={onQFilter}
            capacityBounds={capacityBounds}
            capacityMin={capacityMin}
            capacityMax={capacityMax}
            onCapacityRangeChange={onCapacityRangeChange}
            capacityDisabled={roomsIsFetching || rooms == null}
            sort={roomSort}
            onSortChange={onRoomSortChange}
            sortDisabled={false}
          />
        </div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          {freeAtTimePanel}
        </aside>
      </div>

      <div className="space-y-4">
        {bookings?.bookingRules && (
          <BookingRulesCallout rules={bookings.bookingRules} />
        )}

        {roomsLoadPending ? (
          <div className="space-y-4">
            <p className="sr-only" role="status" aria-live="polite">
              {t("rooms.loadingRooms")}
            </p>
            <div className={roomGridClass} aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="border-te-border/80 bg-te-elevated/40 flex min-h-60 min-w-0 flex-col rounded-xl border p-4 sm:p-5"
                >
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="mt-4 h-7 w-4/5 max-w-48 rounded-md" />
                  <Skeleton className="mt-5 h-10 w-20 rounded-md" />
                  <Skeleton className="mt-4 h-4 w-full max-w-56 rounded" />
                  <Skeleton className="mt-auto h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${roomGridClass} ${roomGridStaleClass}`}>
            <div className="border-te-border bg-te-elevated/50 text-te-muted col-span-full rounded-xl border border-dashed px-4 py-12 text-center text-sm">
              {slotFilterActive && crossesDayUi
                ? t("rooms.emptyCrossesDay")
                : slotFilterActive
                  ? t("rooms.emptySlotFilter")
                  : t("rooms.emptyNoMatch")}
            </div>
          </div>
        ) : (
          <div className={roomGridStaleClass}>
            <VirtualizedWindowGrid
              enabled={isTabActive}
              items={filtered}
              getItemKey={(r) => r.id}
              minCardWidthPx={272}
              estimateRowHeightPx={312}
              gapPx={16}
              renderItem={(room) => {
                const rr = getRoomRating(room.name);
                const betyg =
                  rr != null
                    ? rr.overall.toLocaleString(appLocaleBcp47(), {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })
                    : null;
                const fetchFailed = failedRoomIds.has(room.id);
                return (
                  <article className="group border-te-border bg-te-elevated hover:border-te-accent/25 flex h-full min-h-60 min-w-0 flex-col rounded-xl border p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
                    <div className="min-h-0 min-w-0 flex-1 space-y-4">
                      <header className="min-w-0">
                        <h3 className="font-display text-te-text text-xl leading-[1.15] font-semibold tracking-tight sm:text-2xl">
                          {room.name}
                        </h3>
                      </header>

                      {fetchFailed && (
                        <p className="text-te-danger text-xs font-medium">
                          {t("rooms.fetchScheduleFailed")}
                        </p>
                      )}

                      {slotFilterActive &&
                        slotInterval &&
                        !slotInterval.crossesDay &&
                        !fetchFailed && (
                          <p className="text-te-accent text-xs font-medium">
                            {t("rooms.freeInterval", {
                              start: slotAppliedStart,
                              end: formatLocalTime(
                                parseInstantOnDate(
                                  slotDate,
                                  slotAppliedEnd,
                                ),
                              ),
                            })}
                          </p>
                        )}

                      {rr != null && (
                        <span
                          className="font-display text-te-accent text-3xl leading-none font-semibold tabular-nums sm:text-[2.35rem]"
                          title={rr.comment}
                        >
                          {betyg}
                        </span>
                      )}

                      <p
                        className="text-te-muted text-sm leading-snug"
                        title={t("rooms.seatsTitle", {
                          campus: room.campus,
                          seats:
                            room.capacity != null
                              ? t("rooms.nSeats", { count: room.capacity })
                              : "—",
                        })}
                      >
                        <span className="text-te-text/95 font-medium">
                          {room.campus}
                        </span>
                        <span
                          aria-hidden
                          className="bg-te-border mx-2 inline-block h-3 w-px translate-y-px align-middle"
                        />
                        <span className="tabular-nums">
                          {room.capacity != null
                            ? t("rooms.nSeats", { count: room.capacity })
                            : "—"}
                        </span>
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      className="mt-5 w-full touch-manipulation py-2.5 text-sm"
                      disabled={!canBookRoom(room)}
                      title={
                        fetchFailed
                          ? t("rooms.titleMissingSchedule")
                          : !canBookRoom(room)
                            ? slotFilterActive
                              ? t("rooms.titleNotAvailableSlot")
                              : t("rooms.titleNoFreeWeek")
                            : undefined
                      }
                      onClick={() => {
                        if (slotFilterActive && !crossesDayUi) {
                          onBookRoom(room, {
                            date: slotDate,
                            startTime: slotStartTime,
                            endTime: slotEndTime,
                          });
                          return;
                        }
                        onBookRoom(room);
                      }}
                    >
                      {t("rooms.book")}
                    </Button>
                  </article>
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
