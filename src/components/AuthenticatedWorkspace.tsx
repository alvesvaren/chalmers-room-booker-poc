import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useCallback, useState, useTransition } from "react";
import {
  deleteApiMyBookingsByIdMutation,
  getApiBookingsOptions,
  getApiMyBookingsOptions,
  getApiMyBookingsQueryKey,
  getApiRoomsOptions,
  postApiMyBookingsMutation,
} from "../client/@tanstack/react-query.gen";
import type { Room, RoomWithBookings } from "../client/types.gen";
import { TOAST_DURATION_MS } from "../config/api";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import {
  CAPACITY_SLIDER_FALLBACK_MAX,
  capacitySliderBounds,
  displayCapacityRange,
} from "../lib/capacityBounds";
import { isBookingsGridQuery } from "../lib/bookingsQuery";
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

  const roomsQuery = useSuspenseQuery(getApiRoomsOptions());
  const effectiveBookingsWeekOffset =
    roomsAvailabilityDate != null
      ? weekOffsetForLocalDate(roomsAvailabilityDate)
      : weekOffset;

  const bookingsQuery = useSuspenseQuery(
    getApiBookingsOptions({
      query: {
        weekOffset: String(effectiveBookingsWeekOffset),
        campus: campusFilter.trim() || undefined,
        q: qFilter.trim() || undefined,
      },
    }),
  );

  const myBookingsQuery = useSuspenseQuery(getApiMyBookingsOptions());

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
    (room: RoomWithBookings, gap: TimeInterval) => {
      openBookingSheet(toBookingDraft(room.id, room.name, gap));
    },
    [openBookingSheet],
  );

  const handleBookRoomFromSchedule = useCallback(
    (room: RoomWithBookings) => {
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
      const rw = roomWithBookingsFor(room, bookingsQuery.data.rooms);
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
    [bookingsQuery.data.rooms, openBookingSheet, weekStart, weekEnd],
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
      const rw = roomWithBookingsFor(room, bookingsQuery.data.rooms);
      return firstFreeGapInWeek(rw, weekStart, weekEnd) != null;
    },
    [bookingsQuery.data.rooms, weekStart, weekEnd],
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

  return (
    <>
      <div className="mt-10 space-y-6">
        <AppTabs active={activeTab} onChange={setActiveTab} />

        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="border-te-border bg-te-surface rounded-2xl border p-5 shadow-sm sm:p-8"
        >
          {activeTab === "schedule" ? (
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
              bookings={bookingsQuery.data}
              bookingsIsFetching={bookingsQuery.isFetching}
              myBookings={myBookingsQuery.data}
              onPickFree={handlePickFree}
              onBookRoom={handleBookRoomFromSchedule}
            />
          ) : null}
          {activeTab === "rooms" ? (
            <RoomsTab
              rooms={roomsQuery.data}
              roomsIsFetching={roomsQuery.isFetching}
              bookings={bookingsQuery.data}
              bookingsIsFetching={bookingsQuery.isFetching}
              bookingsWeekStart={weekStart}
              bookingsWeekEnd={weekEnd}
              onRoomsAvailabilityDateChange={setRoomsAvailabilityDate}
              onBookRoom={handleBookRoomFromDirectory}
              isRoomBookable={isRoomBookable}
              capacityBounds={capacityBounds}
              capacityMin={capacityDisplay.min}
              capacityMax={capacityDisplay.max}
              onCapacityRangeChange={setCapacityRange}
            />
          ) : null}
          {activeTab === "mine" ? (
            <MyBookingsTab
              myBookings={myBookingsQuery.data}
              cancelMutation={cancelMutation}
              onCancelRequest={handleCancelBooking}
              cancelError={cancelMutation.isError ? cancelMutation.error : null}
            />
          ) : null}
        </div>
      </div>

      <BookingSheet
        open={bookingSheetOpen}
        onClose={closeBookingSheet}
        initial={bookingInitial}
        scheduleRooms={bookingsQuery.data.rooms}
        myBookings={myBookingsQuery.data}
        onSubmit={(body) =>
          createBookingMutation.mutate(
            { body },
            {
              onSuccess: (data) => {
                closeBookingSheet();
                showBookingToast(`Bokning skapad · ${data.booking.id}`);
              },
            },
          )
        }
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
    </>
  );
}
