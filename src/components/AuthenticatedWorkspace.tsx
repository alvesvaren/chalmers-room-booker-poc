import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  deleteApiMyBookingsByIdMutation,
  getApiBookingsOptions,
  getApiBookingsQueryKey,
  getApiMyBookingsOptions,
  getApiMyBookingsQueryKey,
  getApiRoomsOptions,
  postApiMyBookingsMutation,
} from "../client/@tanstack/react-query.gen";
import { getApiBookings } from "../client/sdk.gen";
import type {
  CreateBookingRequest,
  Room,
  RoomWithReservations,
} from "../client/types.gen";
import { TOAST_DURATION_MS } from "../config/api";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import {
  CAPACITY_SLIDER_FALLBACK_MAX,
  capacitySliderBounds,
  displayCapacityRange,
} from "../lib/capacityBounds";
import { isBookingsGridQuery } from "../lib/bookingsQuery";
import { errorMessage } from "../lib/errors";
import { roomWithBookingsFor } from "../lib/roomSchedule";
import type { TimeInterval } from "../lib/weekTimeline";
import {
  firstFreeGapInWeek,
  getWeekRange,
  parseInstantOnDate,
  roomAvailableForInterval,
  toBookingDraft,
  weekOffsetForLocalDate,
} from "../lib/weekTimeline";
import { AppTabs, type AppTabId } from "./AppTabs";
import { BookingSheet, type BookingSheetInitial } from "./BookingSheet";
import { MyBookingsTab } from "./MyBookingsTab";
import { QueryErrorBoundary } from "./QueryErrorBoundary";
import { RoomsTab } from "./RoomsTab";
import { ScheduleTab } from "./ScheduleTab";

export function AuthenticatedWorkspace() {
  const queryClient = useQueryClient();
  const [, startFilterTransition] = useTransition();

  const [weekOffset, setWeekOffset] = useState(0);
  const [campusFilter, setCampusFilter] = useState("");
  const [qFilter, setQFilter] = useState("");
  const [capacityRange, setCapacityRange] = useState({
    min: 1,
    max: CAPACITY_SLIDER_FALLBACK_MAX,
  });
  const [activeTab, setActiveTab] = useState<AppTabId>("schedule");
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingInitial, setBookingInitial] =
    useState<BookingSheetInitial | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [roomsAvailabilityDate, setRoomsAvailabilityDate] = useState<
    string | null
  >(null);

  const effectiveBookingsWeekOffset =
    roomsAvailabilityDate != null
      ? weekOffsetForLocalDate(roomsAvailabilityDate)
      : weekOffset;

  const bookingsRequestQuery = useMemo(() => {
    const c = campusFilter.trim();
    const q = qFilter.trim();
    const base: { weekOffset: string; campus?: string; q?: string } = {
      weekOffset: String(effectiveBookingsWeekOffset),
    };
    if (c) base.campus = c;
    if (q) base.q = q;
    return base;
  }, [effectiveBookingsWeekOffset, campusFilter, qFilter]);

  const roomsQueryOptions = useMemo(() => getApiRoomsOptions(), []);
  const roomsQuery = useQuery(roomsQueryOptions);

  const bookingsQueryOptions = useMemo(() => {
    const base = getApiBookingsOptions({ query: bookingsRequestQuery });
    type BookingsQK = ReturnType<typeof getApiBookingsQueryKey>;
    return {
      ...base,
      /**
       * Omit TanStack's `signal` so leaving this query (e.g. week change) does not mark the
       * fetch as abort-consuming; in-flight requests finish and populate the cache in the background.
       */
      queryFn: async ({ queryKey }: QueryFunctionContext<BookingsQK>) => {
        const { data } = await getApiBookings({
          ...queryKey[0],
          throwOnError: true,
        });
        return data;
      },
    };
  }, [bookingsRequestQuery]);
  const bookingsQuery = useQuery(bookingsQueryOptions);

  const myBookingsQueryOptions = useMemo(() => getApiMyBookingsOptions(), []);
  const myBookingsQuery = useQuery(myBookingsQueryOptions);

  const bookingsGrid = bookingsQuery.data;

  const bookingsUiStale =
    Boolean(bookingsGrid) &&
    bookingsQuery.isFetching &&
    bookingsQuery.isStale;
  const roomsUiStale =
    Boolean(roomsQuery.data) && roomsQuery.isFetching && roomsQuery.isStale;
  const myBookingsUiStale =
    Boolean(myBookingsQuery.data) &&
    myBookingsQuery.isFetching &&
    myBookingsQuery.isStale;

  const capacityBounds = capacitySliderBounds(roomsQuery.data);
  const capacityDisplay = displayCapacityRange(capacityBounds, capacityRange);

  const { weekStart, weekEnd } = getWeekRange(effectiveBookingsWeekOffset);

  const runBookingsFilterUpdate = useCallback(
    (update: () => void) => {
      startFilterTransition(update);
    },
    [startFilterTransition],
  );

  const setCampusFilterTransitioned = useCallback(
    (v: string) => runBookingsFilterUpdate(() => setCampusFilter(v)),
    [runBookingsFilterUpdate],
  );

  const setQFilterTransitioned = useCallback(
    (v: string) => runBookingsFilterUpdate(() => setQFilter(v)),
    [runBookingsFilterUpdate],
  );

  const createBookingMutation = useMutation({
    ...postApiMyBookingsMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMyBookingsQueryKey(),
      });
      await queryClient.invalidateQueries({ predicate: isBookingsGridQuery });
    },
  });

  const cancelMutation = useMutation({
    ...deleteApiMyBookingsByIdMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMyBookingsQueryKey(),
      });
      await queryClient.invalidateQueries({ predicate: isBookingsGridQuery });
    },
  });

  const openBookingSheet = useCallback(
    (initial: BookingSheetInitial) => {
      createBookingMutation.reset();
      setBookingInitial(initial);
      setBookingSheetOpen(true);
    },
    [createBookingMutation],
  );

  const handlePickFree = useCallback(
    (room: RoomWithReservations, gap: TimeInterval) => {
      openBookingSheet(toBookingDraft(room.id, room.name, gap));
    },
    [openBookingSheet],
  );

  const handleBookRoomFromSchedule = useCallback(
    (room: RoomWithReservations) => {
      const gap = firstFreeGapInWeek(room, weekStart, weekEnd);
      if (!gap) return;
      openBookingSheet(toBookingDraft(room.id, room.name, gap));
    },
    [openBookingSheet, weekStart, weekEnd],
  );

  const handleBookRoomFromDirectory = useCallback(
    (
      room: Room,
      slot?: { date: string; startTime: string; endTime: string },
    ) => {
      if (!bookingsGrid) return;
      const rw = roomWithBookingsFor(room, bookingsGrid.rooms);
      if (slot) {
        const start = parseInstantOnDate(slot.date, slot.startTime);
        const end = parseInstantOnDate(slot.date, slot.endTime);
        if (
          !roomAvailableForInterval(
            rw,
            weekStart,
            weekEnd,
            slot.date,
            start,
            end,
          )
        ) {
          return;
        }
        openBookingSheet({
          roomId: room.id,
          roomName: room.name,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
        return;
      }
      const gap = firstFreeGapInWeek(rw, weekStart, weekEnd);
      if (!gap) return;
      openBookingSheet(toBookingDraft(room.id, room.name, gap));
    },
    [bookingsGrid, openBookingSheet, weekStart, weekEnd],
  );

  const handleCancelBooking = useCallback(
    (id: string) => {
      if (!window.confirm("Avboka denna reservation?")) return;
      cancelMutation.mutate({ path: { id } });
    },
    [cancelMutation],
  );

  const isRoomBookable = useCallback(
    (room: Room) => {
      if (!bookingsGrid) return false;
      const rw = roomWithBookingsFor(room, bookingsGrid.rooms);
      return firstFreeGapInWeek(rw, weekStart, weekEnd) != null;
    },
    [bookingsGrid, weekStart, weekEnd],
  );

  const onWeekNavigate = useCallback((next: number) => {
    setRoomsAvailabilityDate(null);
    setWeekOffset(next);
  }, []);

  const showBookingToast = useCallback(
    (message: string) => setToast(message),
    [],
  );

  const clearBookingToast = useCallback(() => setToast(null), []);
  useAutoDismiss(toast, clearBookingToast, TOAST_DURATION_MS);

  const closeBookingSheet = useCallback(() => {
    setBookingSheetOpen(false);
    setBookingInitial(null);
    createBookingMutation.reset();
  }, [createBookingMutation]);

  const submitBooking = useCallback(
    (body: CreateBookingRequest) => {
      createBookingMutation.mutate(
        { body },
        {
          onSuccess: (data) => {
            closeBookingSheet();
            showBookingToast(`Bokning skapad · ${data.booking.id}`);
          },
        },
      );
    },
    [closeBookingSheet, createBookingMutation, showBookingToast],
  );

  const workspaceError =
    roomsQuery.isError || bookingsQuery.isError || myBookingsQuery.isError
      ? (roomsQuery.error ??
        bookingsQuery.error ??
        myBookingsQuery.error ??
        null)
      : null;

  const tabPanelProps = (id: AppTabId) => ({
    id: `panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${id}`,
    hidden: activeTab !== id,
    className: "space-y-0",
  });

  return (
    <div className="mt-10 space-y-6">
      <AppTabs active={activeTab} onChange={setActiveTab} />

      <QueryErrorBoundary>
        <div className="border-te-border bg-te-surface rounded-2xl border p-5 shadow-sm sm:p-8">
          {workspaceError ? (
            <div
              className="border-te-danger/30 bg-te-danger-bg text-te-danger mb-6 rounded-xl border px-4 py-3 text-sm"
              role="alert"
            >
              {errorMessage(workspaceError)}
            </div>
          ) : null}

          <section {...tabPanelProps("schedule")}>
            <ScheduleTab
              weekOffset={
                roomsAvailabilityDate != null
                  ? effectiveBookingsWeekOffset
                  : weekOffset
              }
              onWeekOffsetChange={onWeekNavigate}
              campusFilter={campusFilter}
              onCampusFilter={setCampusFilterTransitioned}
              qFilter={qFilter}
              onQFilter={setQFilterTransitioned}
              capacityBounds={capacityBounds}
              capacityMin={capacityDisplay.min}
              capacityMax={capacityDisplay.max}
              onCapacityRangeChange={setCapacityRange}
              bookings={bookingsGrid}
              bookingsIsFetching={bookingsQuery.isFetching}
              bookingsUiStale={bookingsUiStale}
              bookingsFailed={bookingsQuery.isError}
              myBookings={myBookingsQuery.data}
              myBookingsUiStale={myBookingsUiStale}
              onPickFree={handlePickFree}
              onBookRoom={handleBookRoomFromSchedule}
              isTabActive={activeTab === "schedule"}
            />
          </section>

          <section {...tabPanelProps("rooms")}>
            <RoomsTab
              rooms={roomsQuery.data}
              roomsIsFetching={roomsQuery.isFetching}
              roomsUiStale={roomsUiStale}
              bookings={bookingsGrid}
              bookingsIsFetching={bookingsQuery.isFetching}
              bookingsUiStale={bookingsUiStale}
              bookingsWeekStart={weekStart}
              bookingsWeekEnd={weekEnd}
              onRoomsAvailabilityDateChange={setRoomsAvailabilityDate}
              onBookRoom={handleBookRoomFromDirectory}
              isRoomBookable={isRoomBookable}
              capacityBounds={capacityBounds}
              capacityMin={capacityDisplay.min}
              capacityMax={capacityDisplay.max}
              onCapacityRangeChange={setCapacityRange}
              isTabActive={activeTab === "rooms"}
            />
          </section>

          <section {...tabPanelProps("mine")}>
            <MyBookingsTab
              rooms={roomsQuery.data}
              myBookings={myBookingsQuery.data}
              loadPending={myBookingsQuery.isPending}
              uiStale={myBookingsUiStale}
              cancelMutation={cancelMutation}
              onCancelRequest={handleCancelBooking}
              cancelError={cancelMutation.isError ? cancelMutation.error : null}
            />
          </section>
        </div>
      </QueryErrorBoundary>

      <BookingSheet
        open={bookingSheetOpen}
        onClose={closeBookingSheet}
        initial={bookingInitial}
        scheduleRooms={bookingsGrid?.rooms}
        myBookings={myBookingsQuery.data}
        onSubmit={submitBooking}
        isPending={createBookingMutation.isPending}
        error={
          createBookingMutation.isError ? createBookingMutation.error : null
        }
      />

      {toast ? (
        <div
          className="border-te-border bg-te-elevated text-te-text fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
