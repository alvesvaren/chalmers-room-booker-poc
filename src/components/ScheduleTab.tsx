import { useId, useMemo, useState } from "react";
import type {
  AllRoomsBookings,
  Booking,
  RoomWithBookings,
} from "../client/types.gen";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { ratingSortValue } from "../lib/roomRatings";
import {
  formatWeekRangeLabel,
  getWeekRange,
  type TimeInterval,
} from "../lib/weekTimeline";
import { RoomWeekCard } from "./RoomWeekCard";
import { WorkspaceSuspenseFallback } from "./skeletons/ScheduleGridSkeleton";
import { VirtualizedWindowGrid } from "./VirtualizedWindowGrid";
import { Button } from "./ui/Button";
import { CapacityRangeSlider } from "./ui/CapacityRangeSlider";

export function ScheduleTab({
  weekOffset,
  onWeekOffsetChange,
  campusFilter,
  onCampusFilter,
  qFilter,
  onQFilter,
  capacityBounds,
  capacityMin,
  capacityMax,
  onCapacityRangeChange,
  bookings,
  bookingsIsFetching,
  bookingsIsRevalidating,
  bookingsFailed,
  myBookings,
  myBookingsIsRevalidating,
  onPickFree,
  onBookRoom,
  isTabActive,
}: {
  weekOffset: number;
  onWeekOffsetChange: (n: number) => void;
  campusFilter: string;
  onCampusFilter: (v: string) => void;
  qFilter: string;
  onQFilter: (v: string) => void;
  capacityBounds: { min: number; max: number };
  capacityMin: number;
  capacityMax: number;
  onCapacityRangeChange: (next: { min: number; max: number }) => void;
  bookings: AllRoomsBookings | undefined;
  bookingsIsFetching: boolean;
  bookingsIsRevalidating: boolean;
  bookingsFailed?: boolean;
  myBookings: Booking[] | undefined;
  myBookingsIsRevalidating: boolean;
  onPickFree: (room: RoomWithBookings, gap: TimeInterval) => void;
  onBookRoom: (room: RoomWithBookings) => void;
  /** False while this tabpanel is `hidden` — keeps window virtualizer from measuring 0×0. */
  isTabActive: boolean;
}) {
  const rulesId = useId();
  const [rulesOpen, setRulesOpen] = useState(false);
  const { weekStart, weekEnd } = getWeekRange(weekOffset);
  const label = formatWeekRangeLabel(weekStart, weekEnd);

  const hasBookings = bookings != null;
  const roomsSorted = useMemo(() => {
    if (!bookings) return [];
    const rooms = [...bookings.rooms].filter((r) =>
      roomMatchesCapacityFilter(r, capacityMin, capacityMax),
    );
    rooms.sort((a, b) => {
      const cmp = ratingSortValue(b.name) - ratingSortValue(a.name);
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, "sv");
    });
    return rooms;
  }, [bookings, capacityMin, capacityMax]);

  const filterGrid = "grid w-full grid-cols-1 gap-3 sm:grid-cols-2";
  const inputClass =
    "min-w-0 w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2.5 text-base text-te-text outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:py-2 sm:text-sm";
  const scheduleGridClass =
    "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]";
  const panelBusyClass =
    bookingsIsRevalidating || myBookingsIsRevalidating
      ? "opacity-60 saturate-[0.85] transition-[opacity,filter] duration-150"
      : "";

  return (
    <div className={`te-reveal te-reveal-delay-1 space-y-6 ${panelBusyClass}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-te-text text-xl font-semibold">
            Veckoschema
          </h2>
          <p className="text-te-muted mt-1 text-sm">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => onWeekOffsetChange(weekOffset - 1)}
          >
            ← Föregående
          </Button>
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => onWeekOffsetChange(0)}
          >
            Denna vecka
          </Button>
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => onWeekOffsetChange(weekOffset + 1)}
          >
            Nästa →
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className={filterGrid}>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-te-muted font-medium">Campus</span>
            <input
              className={inputClass}
              value={campusFilter}
              onChange={(e) => onCampusFilter(e.target.value)}
              placeholder="Johanneberg"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-te-muted font-medium">Namn</span>
            <input
              className={inputClass}
              value={qFilter}
              onChange={(e) => onQFilter(e.target.value)}
              placeholder="Sök rum"
            />
          </label>
        </div>
        <CapacityRangeSlider
          minBound={capacityBounds.min}
          maxBound={capacityBounds.max}
          valueMin={capacityMin}
          valueMax={capacityMax}
          onChange={onCapacityRangeChange}
          disabled={bookingsIsFetching || !hasBookings}
        />
      </div>

      {hasBookings && bookings.errors?.length ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <ul className="list-inside list-disc">
            {bookings.errors.map((e) => (
              <li key={e.roomId}>
                {e.roomId}: {e.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasBookings && bookings.bookingRules ? (
        <div className="border-te-border bg-te-surface rounded-xl border">
          <button
            type="button"
            id={rulesId}
            className="text-te-text flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
            aria-expanded={rulesOpen}
            onClick={() => setRulesOpen((o) => !o)}
          >
            Bokningsregler
            <span className="text-te-muted">{rulesOpen ? "▼" : "►"}</span>
          </button>
          {rulesOpen ? (
            <div className="border-te-border text-te-muted max-h-48 overflow-y-auto border-t px-4 py-3 text-sm leading-relaxed">
              {bookings.bookingRules}
            </div>
          ) : null}
        </div>
      ) : null}

      {!hasBookings && !bookingsFailed ? (
        <WorkspaceSuspenseFallback />
      ) : hasBookings && roomsSorted.length === 0 ? (
        <div className={scheduleGridClass}>
          <div className="border-te-border bg-te-elevated/50 text-te-muted col-span-full rounded-xl border border-dashed px-4 py-12 text-center text-sm">
            Inga rum för denna filtrering.
          </div>
        </div>
      ) : hasBookings ? (
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
      ) : null}
    </div>
  );
}
