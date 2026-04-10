import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { appLocaleBcp47 } from "../lib/datetime/intlFormat";
import { compareRoomsForSort } from "../lib/roomSort";
import {
  formatWeekRangeLabel,
  getWeekRange,
  roomAvailableForInterval,
  weekOffsetForLocalDate,
} from "../lib/weekTimeline";
import { BookingRulesCallout } from "./BookingRulesCallout";
import { FreeAtTimeFilterCard } from "./FreeAtTimeFilterCard";
import { RoomFiltersCard } from "./RoomFiltersCard";
import { RoomWeekCard } from "./RoomWeekCard";
import { WorkspaceSuspenseFallback } from "./skeletons/ScheduleGridSkeleton";
import { VirtualizedWindowGrid } from "./VirtualizedWindowGrid";
import { Button } from "./ui/Button";
import type { ScheduleTabProps } from "./workspaceTabProps";

export function ScheduleTab({
  week,
  filters,
  bookings,
  actions,
  isTabActive,
}: ScheduleTabProps) {
  const { weekOffset, onWeekOffsetChange } = week;
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
  const {
    bookings: bookingsData,
    bookingsIsFetching,
    bookingsUiStale,
    bookingsFailed,
    myBookings,
    myBookingsUiStale,
  } = bookings;
  const { onPickFree, onBookRoom } = actions;
  const { t } = useTranslation();
  const collatorLocale = appLocaleBcp47();
  const { weekStart, weekEnd } = getWeekRange(weekOffset);
  const label = formatWeekRangeLabel(weekStart, weekEnd);

  const { weekStart: slotBookingsWeekStart, weekEnd: slotBookingsWeekEnd } =
    getWeekRange(weekOffsetForLocalDate(freeAtTime.slotDate));

  const hasBookings = bookingsData != null;
  const roomsSorted = useMemo(() => {
    if (!bookingsData) return [];
    const failedRoomIds = new Set(
      (bookingsData.errors ?? []).map((e) => e.roomId),
    );
    const q = qFilter.trim().toLowerCase();
    const rooms = [...bookingsData.rooms].filter((r) =>
      roomMatchesCapacityFilter(r, capacityMin, capacityMax),
    );
    const nameFiltered =
      q.length === 0
        ? rooms
        : rooms.filter((r) => r.name.toLowerCase().includes(q));

    const availWeekStart = freeAtTime.active
      ? slotBookingsWeekStart
      : weekStart;
    const availWeekEnd = freeAtTime.active ? slotBookingsWeekEnd : weekEnd;
    const slotIv = freeAtTime.filterInterval;

    const slotFiltered =
      freeAtTime.active && slotIv
        ? nameFiltered.filter((r) => {
            if (failedRoomIds.has(r.id)) return false;
            return roomAvailableForInterval(
              r,
              availWeekStart,
              availWeekEnd,
              freeAtTime.slotDate,
              slotIv.start,
              slotIv.end,
            );
          })
        : nameFiltered;

    slotFiltered.sort((a, b) =>
      compareRoomsForSort(a, b, roomSort, collatorLocale),
    );
    return slotFiltered;
  }, [
    bookingsData,
    qFilter,
    capacityMin,
    capacityMax,
    collatorLocale,
    roomSort,
    freeAtTime.active,
    freeAtTime.slotDate,
    freeAtTime.filterInterval,
    weekStart,
    weekEnd,
    slotBookingsWeekStart,
    slotBookingsWeekEnd,
  ]);

  const slotBookFilterByRoomId = useMemo(() => {
    if (!bookingsData || !freeAtTime.active || freeAtTime.crossesDayUi) {
      return null;
    }
    const failedRoomIds = new Set(
      (bookingsData.errors ?? []).map((e) => e.roomId),
    );
    const slotIv = freeAtTime.filterInterval;
    const map = new Map<
      string,
      {
        dateStr: string;
        startTime: string;
        endTime: string;
        slotAvailable: boolean;
        crossesDayUi: boolean;
      }
    >();
    for (const r of bookingsData.rooms) {
      if (failedRoomIds.has(r.id)) {
        map.set(r.id, {
          dateStr: freeAtTime.slotDate,
          startTime: freeAtTime.slotStartTime,
          endTime: freeAtTime.slotEndTime,
          slotAvailable: false,
          crossesDayUi: freeAtTime.crossesDayUi,
        });
        continue;
      }
      const ok =
        slotIv != null &&
        roomAvailableForInterval(
          r,
          slotBookingsWeekStart,
          slotBookingsWeekEnd,
          freeAtTime.slotDate,
          slotIv.start,
          slotIv.end,
        );
      map.set(r.id, {
        dateStr: freeAtTime.slotDate,
        startTime: freeAtTime.slotStartTime,
        endTime: freeAtTime.slotEndTime,
        slotAvailable: ok,
        crossesDayUi: freeAtTime.crossesDayUi,
      });
    }
    return map;
  }, [
    bookingsData,
    freeAtTime.active,
    freeAtTime.crossesDayUi,
    freeAtTime.slotDate,
    freeAtTime.slotStartTime,
    freeAtTime.slotEndTime,
    freeAtTime.filterInterval,
    slotBookingsWeekStart,
    slotBookingsWeekEnd,
  ]);

  const scheduleGridClass =
    "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]";
  const panelBusyClass =
    bookingsUiStale || myBookingsUiStale
      ? "opacity-60 saturate-[0.85] transition-[opacity,filter] duration-150"
      : "";

  return (
    <div className="te-reveal te-reveal-delay-1">
      <div className={`space-y-6 ${panelBusyClass}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-te-text text-xl font-semibold">
              {t("schedule.heading")}
            </h2>
            <p className="text-te-muted mt-1 text-sm">{label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => onWeekOffsetChange(weekOffset - 1)}
            >
              {t("schedule.prev")}
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => onWeekOffsetChange(0)}
            >
              {t("schedule.thisWeek")}
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => onWeekOffsetChange(weekOffset + 1)}
            >
              {t("schedule.next")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_minmax(17rem,22rem)] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-4">
            <RoomFiltersCard
              nameFieldId="schedule-room-search"
              nameLabel={t("schedule.name")}
              searchPlaceholder={t("schedule.searchPlaceholder")}
              searchValue={qFilter}
              onSearchChange={onQFilter}
              capacityBounds={capacityBounds}
              capacityMin={capacityMin}
              capacityMax={capacityMax}
              onCapacityRangeChange={onCapacityRangeChange}
              capacityDisabled={bookingsIsFetching || !hasBookings}
              sort={roomSort}
              onSortChange={onRoomSortChange}
              sortDisabled={bookingsIsFetching || !hasBookings}
            />

            {hasBookings && bookingsData.bookingRules && (
              <BookingRulesCallout rules={bookingsData.bookingRules} />
            )}
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

        {hasBookings &&
          bookingsData.errors &&
          bookingsData.errors.length > 0 && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              <ul className="list-inside list-disc">
                {bookingsData.errors.map((e) => (
                  <li key={e.roomId}>
                    {e.roomId}: {e.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

        {!hasBookings && !bookingsFailed && <WorkspaceSuspenseFallback />}
        {hasBookings && roomsSorted.length === 0 && (
          <div className={scheduleGridClass}>
            <div className="border-te-border bg-te-elevated/50 text-te-muted col-span-full rounded-xl border border-dashed px-4 py-12 text-center text-sm">
              {freeAtTime.active && freeAtTime.crossesDayUi
                ? t("rooms.emptyCrossesDay")
                : freeAtTime.active
                  ? t("rooms.emptySlotFilter")
                  : t("schedule.emptyFilter")}
            </div>
          </div>
        )}
        {hasBookings && roomsSorted.length > 0 && (
          <VirtualizedWindowGrid
            enabled={isTabActive}
            items={roomsSorted}
            getItemKey={(r) => r.id}
            minCardWidthPx={416}
            estimateRowHeightPx={620}
            renderItem={(room) => (
              <RoomWeekCard
                room={room}
                weekStart={weekStart}
                weekEndExclusive={weekEnd}
                onPickFree={onPickFree}
                onBookRoom={onBookRoom}
                myBookings={myBookings ?? []}
                slotBookFilter={
                  slotBookFilterByRoomId
                    ? (slotBookFilterByRoomId.get(room.id) ?? {
                        dateStr: freeAtTime.slotDate,
                        startTime: freeAtTime.slotStartTime,
                        endTime: freeAtTime.slotEndTime,
                        slotAvailable: false,
                        crossesDayUi: freeAtTime.crossesDayUi,
                      })
                    : undefined
                }
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
