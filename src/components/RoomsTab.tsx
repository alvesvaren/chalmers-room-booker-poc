import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Room } from "../client/types.gen";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { compareRoomsForSort } from "../lib/roomSort";
import { appLocaleBcp47 } from "../lib/datetime/intlFormat";
import { roomWithBookingsFor } from "../lib/roomSchedule";
import { getRoomRating } from "../lib/roomRatings";
import { formatLocalTime, roomAvailableForInterval } from "../lib/weekTimeline";
import { FreeAtTimeFilterCard } from "./FreeAtTimeFilterCard";
import { BookingRulesCallout } from "./BookingRulesCallout";
import { RoomFiltersCard } from "./RoomFiltersCard";
import { VirtualizedWindowGrid } from "./VirtualizedWindowGrid";
import type { RoomsTabProps } from "./workspaceTabProps";
import { Button } from "./ui/Button";
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
    freeAtTime,
  } = filters;
  const { onBookRoom, isRoomBookable } = actions;
  const { t } = useTranslation();
  const collatorLocale = appLocaleBcp47();
  const {
    active: slotFilterActive,
    slotDate,
    slotStartTime,
    slotEndTime,
    crossesDayUi,
    filterInterval: slotInterval,
  } = freeAtTime;

  const failedRoomIds = useMemo(() => {
    const e = bookings?.errors;
    if (!e?.length) return new Set<string>();
    return new Set(e.map((x) => x.roomId));
  }, [bookings?.errors]);

  const roomList = useMemo(() => rooms ?? [], [rooms]);

  const roomSlotOk = useCallback(
    (room: Room): boolean => {
      if (!bookings) return false;
      if (!slotFilterActive || !slotInterval) {
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
        if (!slotInterval) return false;
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

  const roomGridClass =
    "grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]";

  const slotBookingsStaleUi =
    slotFilterActive && bookings != null && bookingsUiStale;

  const roomsLoadPending = rooms == null && roomsIsFetching;

  const roomGridStaleClass =
    roomsUiStale || slotBookingsStaleUi || bookingsUiStale
      ? "opacity-60 saturate-[0.85] transition-[opacity,filter] duration-150"
      : "";

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
          <FreeAtTimeFilterCard
            active={freeAtTime.active}
            onActiveChange={freeAtTime.onActiveChange}
            minBookDate={freeAtTime.minBookDate}
            slotDate={freeAtTime.slotDate}
            onSlotDateChange={freeAtTime.onSlotDateChange}
            slotStartTime={freeAtTime.slotStartTime}
            slotEndTime={freeAtTime.slotEndTime}
            onSlotIntervalChange={freeAtTime.onSlotIntervalChange}
            crossesDayUi={freeAtTime.crossesDayUi}
            bookingsWeekLabel={freeAtTime.bookingsWeekLabel}
            showBookingsWeekFetching={freeAtTime.showBookingsWeekFetching}
          />
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
                        !fetchFailed && (
                          <p className="text-te-accent text-xs font-medium">
                            {t("rooms.freeInterval", {
                              start: formatLocalTime(slotInterval.start),
                              end: formatLocalTime(slotInterval.end),
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
