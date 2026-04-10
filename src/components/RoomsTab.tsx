import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Room } from "../client/types.gen";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { compareRoomsForSort, type RoomSort } from "../lib/roomSort";
import { appLocaleBcp47 } from "../lib/datetime/intlFormat";
import { defaultAvailabilityFilterStartTime } from "../lib/bookingSheetMath";
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
import { DurationPickerSection } from "./DurationPickerSection";
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
    capacityBounds,
    capacityMin,
    capacityMax,
    onCapacityRangeChange,
  } = filters;
  const { onRoomsAvailabilityDateChange, onBookRoom, isRoomBookable } =
    actions;
  const { t } = useTranslation();
  const collatorLocale = appLocaleBcp47();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RoomSort>({
    mode: "rating",
    invert: false,
  });
  const [slotFilterActive, setSlotFilterActive] = useState(false);
  const [slotDate, setSlotDate] = useState(() => formatLocalDate(new Date()));
  const [slotStartTime, setSlotStartTime] = useState(() =>
    defaultAvailabilityFilterStartTime(formatLocalDate(new Date())),
  );
  const [slotDurationMin, setSlotDurationMin] = useState(120);

  const minBookDate = formatLocalDate(new Date());

  const setSlotFilterActiveSynced = useCallback(
    (checked: boolean) => {
      setSlotFilterActive(checked);
      if (checked) {
        setSlotStartTime(defaultAvailabilityFilterStartTime(slotDate));
      }
      onRoomsAvailabilityDateChange(checked ? slotDate : null);
    },
    [onRoomsAvailabilityDateChange, slotDate],
  );

  const setSlotDateSynced = useCallback(
    (nextDate: string) => {
      setSlotDate(nextDate);
      if (nextDate === formatLocalDate(new Date())) {
        setSlotStartTime(defaultAvailabilityFilterStartTime(nextDate));
      }
      if (slotFilterActive) onRoomsAvailabilityDateChange(nextDate);
    },
    [onRoomsAvailabilityDateChange, slotFilterActive],
  );

  const failedRoomIds = useMemo(() => {
    const e = bookings?.errors;
    if (!e?.length) return new Set<string>();
    return new Set(e.map((x) => x.roomId));
  }, [bookings?.errors]);

  const roomList = useMemo(() => rooms ?? [], [rooms]);

  const slotInterval = useMemo(() => {
    if (!slotFilterActive) return null;
    const start = parseInstantOnDate(slotDate, slotStartTime);
    const end = addMinutes(start, slotDurationMin);
    return {
      start,
      end,
      endTime: formatLocalTime(end),
      crossesDay: formatLocalDate(end) !== slotDate,
    };
  }, [slotFilterActive, slotDate, slotStartTime, slotDurationMin]);

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
    const q = search.trim().toLowerCase();
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
      compareRoomsForSort(a, b, sort, collatorLocale),
    );
    return list;
  }, [
    roomList,
    search,
    capacityMin,
    capacityMax,
    sort,
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

  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <h2 className="font-display text-te-text text-xl font-semibold">
        {t("rooms.heading")}
      </h2>

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

        {slotFilterActive && (
          <div className="border-te-border/60 mt-4 min-w-0 space-y-5 border-t pt-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-te-muted font-medium">
                  {t("rooms.day")}
                </span>
                <input
                  type="date"
                  className={fieldClass}
                  min={minBookDate}
                  value={slotDate}
                  onChange={(e) => setSlotDateSynced(e.target.value)}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-te-muted font-medium">
                  {t("rooms.start")}
                </span>
                <input
                  type="time"
                  className={fieldClass}
                  value={slotStartTime}
                  onChange={(e) => setSlotStartTime(e.target.value)}
                />
              </label>
              <div className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-te-muted font-medium">
                  {t("rooms.interval")}
                </span>
                <p className="border-te-border/80 bg-te-surface/80 text-te-text rounded-lg border border-dashed px-3 py-2.5 font-mono text-sm tabular-nums sm:py-2.5">
                  {slotInterval && !slotInterval.crossesDay ? (
                    <>
                      {slotStartTime} – {slotInterval.endTime}
                    </>
                  ) : slotInterval?.crossesDay ? (
                    <span className="text-te-danger text-xs font-sans">
                      {t("rooms.crossesMidnight")}
                    </span>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>

            <DurationPickerSection
              valueMinutes={slotDurationMin}
              onChangeMinutes={setSlotDurationMin}
              durationSummaryLabel={t("rooms.durationSummary")}
              presetsHeading={t("rooms.durationPresets")}
              sliderAriaLabel={t("rooms.durationSliderAria")}
            />
          </div>
        )}

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

      <div className="space-y-4">
        <RoomFiltersCard
          nameFieldId="rooms-search"
          nameLabel={t("rooms.name")}
          searchPlaceholder={t("rooms.searchPlaceholder")}
          searchValue={search}
          onSearchChange={setSearch}
          capacityBounds={capacityBounds}
          capacityMin={capacityMin}
          capacityMax={capacityMax}
          onCapacityRangeChange={onCapacityRangeChange}
          capacityDisabled={roomsIsFetching || rooms == null}
          sort={sort}
          onSortChange={setSort}
          sortDisabled={slotFilterActive}
        />

        {bookings?.bookingRules && (
          <BookingRulesCallout rules={bookings.bookingRules} />
        )}
      </div>

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
            {slotFilterActive && slotInterval?.crossesDay
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
                          start: slotStartTime,
                          end: slotInterval.endTime,
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
                    if (
                      slotFilterActive &&
                      slotInterval &&
                      !slotInterval.crossesDay
                    ) {
                      onBookRoom(room, {
                        date: slotDate,
                        startTime: slotStartTime,
                        endTime: slotInterval.endTime,
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
  );
}
