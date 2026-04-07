import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { appLocaleBcp47 } from "../lib/datetime/intlFormat";
import { formatWeekRangeLabel, getWeekRange } from "../lib/weekTimeline";
import { compareRoomsForSort, type RoomSort } from "../lib/roomSort";
import { BookingRulesCallout } from "./BookingRulesCallout";
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
  const [sort, setSort] = useState<RoomSort>({
    mode: "rating",
    invert: false,
  });
  const { weekStart, weekEnd } = getWeekRange(weekOffset);
  const label = formatWeekRangeLabel(weekStart, weekEnd);

  const hasBookings = bookingsData != null;
  const roomsSorted = useMemo(() => {
    if (!bookingsData) return [];
    const rooms = [...bookingsData.rooms].filter((r) =>
      roomMatchesCapacityFilter(r, capacityMin, capacityMax),
    );
    rooms.sort((a, b) =>
      compareRoomsForSort(a, b, sort, collatorLocale),
    );
    return rooms;
  }, [bookingsData, capacityMin, capacityMax, collatorLocale, sort]);

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

        <div className="space-y-4">
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
            sort={sort}
            onSortChange={setSort}
            sortDisabled={bookingsIsFetching || !hasBookings}
          />

          {hasBookings && bookingsData.bookingRules && (
            <BookingRulesCallout rules={bookingsData.bookingRules} />
          )}
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
              {t("schedule.emptyFilter")}
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
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
