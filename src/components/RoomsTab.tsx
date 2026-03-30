import { useCallback, useMemo, useState } from "react";
import type { AllRoomsBookings, Room } from "../client/types.gen";
import { roomMatchesCapacityFilter } from "../lib/capacityBounds";
import { roomWithBookingsFor } from "../lib/roomSchedule";
import { getRoomRating, ratingSortValue } from "../lib/roomRatings";
import {
  addMinutes,
  formatLocalDate,
  formatLocalTime,
  formatWeekRangeLabel,
  parseInstantOnDate,
  roomAvailableForInterval,
} from "../lib/weekTimeline";
import { VirtualizedWindowGrid } from "./VirtualizedWindowGrid";
import { Button } from "./ui/Button";
import { CapacityRangeSlider } from "./ui/CapacityRangeSlider";
import { Skeleton } from "./ui/Skeleton";

type SortKey = "rating" | "name" | "campus" | "capacity";

export function RoomsTab({
  rooms,
  roomsIsFetching,
  bookings,
  bookingsIsFetching,
  bookingsWeekStart,
  bookingsWeekEnd,
  onRoomsAvailabilityDateChange,
  onBookRoom,
  isRoomBookable,
  capacityBounds,
  capacityMin,
  capacityMax,
  onCapacityRangeChange,
  isTabActive,
}: {
  rooms: Room[] | undefined;
  roomsIsFetching: boolean;
  bookings: AllRoomsBookings | undefined;
  bookingsIsFetching: boolean;
  bookingsWeekStart: Date;
  bookingsWeekEnd: Date;
  onRoomsAvailabilityDateChange: (date: string | null) => void;
  onBookRoom: (
    room: Room,
    slot?: { date: string; startTime: string; endTime: string },
  ) => void;
  isRoomBookable: (room: Room) => boolean;
  capacityBounds: { min: number; max: number };
  capacityMin: number;
  capacityMax: number;
  onCapacityRangeChange: (next: { min: number; max: number }) => void;
  /** False while this tabpanel is `hidden` — keeps window virtualizer from measuring 0×0. */
  isTabActive: boolean;
}) {
  const [search, setSearch] = useState("");
  const [campusPick, setCampusPick] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [slotFilterActive, setSlotFilterActive] = useState(false);
  const [slotDate, setSlotDate] = useState(() => formatLocalDate(new Date()));
  const [slotStartTime, setSlotStartTime] = useState("13:30");
  const [slotDurationMin, setSlotDurationMin] = useState(60);

  const minBookDate = formatLocalDate(new Date());

  const setSlotFilterActiveSynced = useCallback(
    (checked: boolean) => {
      setSlotFilterActive(checked);
      onRoomsAvailabilityDateChange(checked ? slotDate : null);
    },
    [onRoomsAvailabilityDateChange, slotDate],
  );

  const setSlotDateSynced = useCallback(
    (nextDate: string) => {
      setSlotDate(nextDate);
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

  const campuses = useMemo(() => {
    const s = new Set<string>();
    for (const r of roomList) {
      if (r.campus) s.add(r.campus);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "sv"));
  }, [roomList]);

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
    if (campusPick) {
      list = list.filter((r) =>
        r.campus.toLowerCase().includes(campusPick.toLowerCase()),
      );
    }
    list = list.filter((r) =>
      roomMatchesCapacityFilter(r, capacityMin, capacityMax),
    );
    if (slotFilterActive) {
      list = list.filter((r) => roomSlotOk(r));
    }
    list.sort((a, b) => {
      if (slotFilterActive) {
        const cmp = ratingSortValue(b.name) - ratingSortValue(a.name);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name, "sv");
      }
      if (sort === "rating") {
        const cmp = ratingSortValue(b.name) - ratingSortValue(a.name);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name, "sv");
      }
      if (sort === "name") {
        return a.name.localeCompare(b.name, "sv");
      }
      if (sort === "campus") {
        const c = a.campus.localeCompare(b.campus, "sv");
        if (c !== 0) return c;
        return a.name.localeCompare(b.name, "sv");
      }
      const ca = a.capacity ?? -1;
      const cb = b.capacity ?? -1;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name, "sv");
    });
    return list;
  }, [
    roomList,
    search,
    campusPick,
    capacityMin,
    capacityMax,
    sort,
    slotFilterActive,
    roomSlotOk,
  ]);

  const filterGrid =
    "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
  const fieldClass =
    "min-w-0 w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2.5 text-base outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:py-2 sm:text-sm";
  const roomGridClass =
    "grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]";

  const slotPanelClass =
    "rounded-2xl border border-te-accent/20 bg-gradient-to-br from-te-accent/[0.07] via-te-elevated to-te-surface p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5";

  const slotBookingsPending =
    slotFilterActive && bookingsIsFetching && bookings != null;

  const roomsLoadPending = rooms == null && roomsIsFetching;

  const bookingsWeekLabel = formatWeekRangeLabel(
    bookingsWeekStart,
    bookingsWeekEnd,
  );

  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <h2 className="font-display text-te-text text-xl font-semibold">Rum</h2>

      <div className={slotPanelClass}>
        <label className="flex cursor-pointer items-start gap-3 select-none">
          <input
            type="checkbox"
            className="border-te-border text-te-accent focus:ring-te-accent/30 mt-1 size-4 shrink-0 rounded"
            checked={slotFilterActive}
            onChange={(e) => setSlotFilterActiveSynced(e.target.checked)}
          />
          <span className="font-display text-te-text text-sm font-semibold">
            Ledig vid tid
          </span>
        </label>

        {slotFilterActive ? (
          <div className="border-te-border/60 mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-te-muted font-medium">Dag</span>
              <input
                type="date"
                className={fieldClass}
                min={minBookDate}
                value={slotDate}
                onChange={(e) => setSlotDateSynced(e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-te-muted font-medium">Start</span>
              <input
                type="time"
                className={fieldClass}
                value={slotStartTime}
                onChange={(e) => setSlotStartTime(e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-te-muted font-medium">Längd (min)</span>
              <input
                type="number"
                min={15}
                max={240}
                step={15}
                className={fieldClass}
                value={slotDurationMin}
                onChange={(e) =>
                  setSlotDurationMin(
                    Math.max(15, Math.min(240, Number(e.target.value))),
                  )
                }
              />
            </label>
            <div className="flex min-w-0 flex-col justify-end gap-1 text-sm">
              <span className="text-te-muted font-medium">Intervall</span>
              <p className="border-te-border/80 bg-te-surface/80 text-te-text rounded-lg border border-dashed px-3 py-2.5 tabular-nums sm:py-2">
                {slotInterval && !slotInterval.crossesDay ? (
                  <>
                    {slotStartTime} – {slotInterval.endTime}
                  </>
                ) : slotInterval?.crossesDay ? (
                  <span className="text-te-danger text-xs">
                    Intervallet passerar midnatt — välj kortare längd.
                  </span>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        ) : null}

        {slotBookingsPending ? (
          <div
            className="border-te-border/60 mt-4 space-y-3 border-t pt-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="sr-only">Hämtar bokningar {bookingsWeekLabel}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-2.5 w-full max-w-40 rounded-full sm:max-w-56" />
              <Skeleton className="hidden h-2.5 w-16 rounded-full sm:block" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className={filterGrid}>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-te-muted font-medium">Namn</span>
            <input
              className={fieldClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök rum"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-te-muted font-medium">Campus</span>
            <select
              className={fieldClass}
              value={campusPick}
              onChange={(e) => setCampusPick(e.target.value)}
            >
              <option value="">Alla</option>
              {campuses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-te-muted font-medium">Sortera</span>
            <select
              className={fieldClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              disabled={slotFilterActive}
            >
              <option value="rating">Betyg</option>
              <option value="name">Namn</option>
              <option value="campus">Campus</option>
              <option value="capacity">Platser</option>
            </select>
          </label>
        </div>
        <CapacityRangeSlider
          minBound={capacityBounds.min}
          maxBound={capacityBounds.max}
          valueMin={capacityMin}
          valueMax={capacityMax}
          onChange={onCapacityRangeChange}
          disabled={roomsIsFetching || rooms == null}
        />
      </div>

      {roomsLoadPending ? (
        <div className="space-y-4">
          <p className="sr-only" role="status" aria-live="polite">
            Laddar rum
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
      ) : slotBookingsPending ? (
        <div className="space-y-4">
          <p className="sr-only" role="status" aria-live="polite">
            Uppdaterar tillgänglighet {bookingsWeekLabel}
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
        <div className={roomGridClass}>
          <div className="border-te-border bg-te-elevated/50 text-te-muted col-span-full rounded-xl border border-dashed px-4 py-12 text-center text-sm">
            {slotFilterActive && slotInterval?.crossesDay
              ? "Intervallet är för långt för en kalenderdag — minska längden."
              : slotFilterActive
                ? "Inga rum är helt lediga vid vald tid med nuvarande filter."
                : "Inga rum matchar."}
          </div>
        </div>
      ) : (
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
                ? rr.overall.toLocaleString("sv-SE", {
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

                  {fetchFailed ? (
                    <p className="text-te-danger text-xs font-medium">
                      Kunde inte ladda TimeEdit-schema för detta rum.
                    </p>
                  ) : null}

                  {slotFilterActive &&
                  slotInterval &&
                  !slotInterval.crossesDay &&
                  !fetchFailed ? (
                    <p className="text-te-accent text-xs font-medium">
                      Ledig {slotStartTime} – {slotInterval.endTime}
                    </p>
                  ) : null}

                  {rr != null ? (
                    <span
                      className="font-display text-te-accent text-3xl leading-none font-semibold tabular-nums sm:text-[2.35rem]"
                      title={rr.comment}
                    >
                      {betyg}
                    </span>
                  ) : null}

                  <p
                    className="text-te-muted text-sm leading-snug"
                    title={`${room.campus} · ${room.capacity ?? "—"} platser`}
                  >
                    <span className="text-te-text/95 font-medium">
                      {room.campus}
                    </span>
                    <span
                      aria-hidden
                      className="bg-te-border mx-2 inline-block h-3 w-px translate-y-px align-middle"
                    />
                    <span className="tabular-nums">
                      {room.capacity ?? "—"} platser
                    </span>
                  </p>
                </div>

                <Button
                  variant="primary"
                  className="mt-5 w-full touch-manipulation py-2.5 text-sm"
                  disabled={!canBookRoom(room)}
                  title={
                    fetchFailed
                      ? "Schema saknas från servern"
                      : !canBookRoom(room)
                        ? slotFilterActive
                          ? "Inte ledigt hela intervallet (eller tiden har passerat)"
                          : "Ingen ledig tid kvar denna vecka från och med nu"
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
                  Boka
                </Button>
              </article>
            );
          }}
        />
      )}
    </div>
  );
}
