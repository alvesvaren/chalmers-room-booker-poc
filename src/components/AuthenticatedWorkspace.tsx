import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type {
  CreateBookingRequest,
  Room,
  RoomWithReservations,
} from "../client/types.gen";
import { TOAST_DURATION_MS } from "../config/api";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useWorkspaceBookingsMutations } from "../hooks/useWorkspaceBookingsMutations";
import { useWorkspaceServerData } from "../hooks/useWorkspaceServerData";
import { CAPACITY_SLIDER_FALLBACK_MAX } from "../lib/capacityBounds";
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
import type {
  MyBookingsTabProps,
  RoomsTabProps,
  ScheduleTabProps,
} from "./workspaceTabProps";

export function AuthenticatedWorkspace() {
  const { t } = useTranslation();
  const [, startFilterTransition] = useTransition();
  const { createBookingMutation, cancelMutation } =
    useWorkspaceBookingsMutations();

  const [weekOffset, setWeekOffset] = useState(0);
  const [campusFilter, setCampusFilter] = useState("");
  const [qFilter, setQFilter] = useState("");
  const [capacityRange, setCapacityRange] = useState({
    min: 1,
    max: CAPACITY_SLIDER_FALLBACK_MAX,
  });
  const [activeTab, setActiveTab] = useState<AppTabId>("rooms");
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

  const {
    roomsQuery,
    bookingsQuery,
    myBookingsQuery,
    bookingsGrid,
    bookingsUiStale,
    roomsUiStale,
    myBookingsUiStale,
    capacityBounds,
    capacityDisplay,
    workspaceError,
  } = useWorkspaceServerData(bookingsRequestQuery, capacityRange);

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
      if (!window.confirm(t("booking.confirmCancel"))) return;
      cancelMutation.mutate({ path: { id } });
    },
    [cancelMutation, t],
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
            showBookingToast(
              t("booking.createdToast", { id: data.booking.id }),
            );
          },
        },
      );
    },
    [closeBookingSheet, createBookingMutation, showBookingToast, t],
  );

  const tabPanelProps = (id: AppTabId) => ({
    id: `panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${id}`,
    hidden: activeTab !== id,
    className: "space-y-0",
  });

  const roomsTabProps: RoomsTabProps = useMemo(
    () => ({
      data: {
        rooms: roomsQuery.data,
        bookings: bookingsGrid,
        bookingsWeekStart: weekStart,
        bookingsWeekEnd: weekEnd,
      },
      status: {
        roomsIsFetching: roomsQuery.isFetching,
        roomsUiStale,
        bookingsIsFetching: bookingsQuery.isFetching,
        bookingsUiStale,
      },
      filters: {
        capacityBounds,
        capacityMin: capacityDisplay.min,
        capacityMax: capacityDisplay.max,
        onCapacityRangeChange: setCapacityRange,
      },
      actions: {
        onRoomsAvailabilityDateChange: setRoomsAvailabilityDate,
        onBookRoom: handleBookRoomFromDirectory,
        isRoomBookable,
      },
      isTabActive: activeTab === "rooms",
    }),
    [
      roomsQuery.data,
      roomsQuery.isFetching,
      bookingsGrid,
      weekStart,
      weekEnd,
      roomsUiStale,
      bookingsQuery.isFetching,
      bookingsUiStale,
      capacityBounds,
      capacityDisplay.min,
      capacityDisplay.max,
      handleBookRoomFromDirectory,
      isRoomBookable,
      activeTab,
    ],
  );

  const scheduleWeekOffset =
    roomsAvailabilityDate != null ? effectiveBookingsWeekOffset : weekOffset;

  const scheduleTabProps: ScheduleTabProps = useMemo(
    () => ({
      week: {
        weekOffset: scheduleWeekOffset,
        onWeekOffsetChange: onWeekNavigate,
      },
      filters: {
        campusFilter,
        onCampusFilter: setCampusFilterTransitioned,
        qFilter,
        onQFilter: setQFilterTransitioned,
        capacityBounds,
        capacityMin: capacityDisplay.min,
        capacityMax: capacityDisplay.max,
        onCapacityRangeChange: setCapacityRange,
      },
      bookings: {
        bookings: bookingsGrid,
        bookingsIsFetching: bookingsQuery.isFetching,
        bookingsUiStale,
        bookingsFailed: bookingsQuery.isError,
        myBookings: myBookingsQuery.data,
        myBookingsUiStale,
      },
      actions: {
        onPickFree: handlePickFree,
        onBookRoom: handleBookRoomFromSchedule,
      },
      isTabActive: activeTab === "schedule",
    }),
    [
      scheduleWeekOffset,
      onWeekNavigate,
      campusFilter,
      setCampusFilterTransitioned,
      qFilter,
      setQFilterTransitioned,
      capacityBounds,
      capacityDisplay.min,
      capacityDisplay.max,
      bookingsGrid,
      bookingsQuery.isFetching,
      bookingsQuery.isError,
      bookingsUiStale,
      myBookingsQuery.data,
      myBookingsUiStale,
      handlePickFree,
      handleBookRoomFromSchedule,
      activeTab,
    ],
  );

  const myBookingsTabProps: MyBookingsTabProps = useMemo(
    () => ({
      data: {
        rooms: roomsQuery.data,
        myBookings: myBookingsQuery.data,
      },
      status: {
        loadPending: myBookingsQuery.isPending,
        uiStale: myBookingsUiStale,
        cancelError: cancelMutation.isError ? cancelMutation.error : null,
      },
      actions: {
        cancelMutation,
        onCancelRequest: handleCancelBooking,
      },
    }),
    [
      roomsQuery.data,
      myBookingsQuery.data,
      myBookingsQuery.isPending,
      myBookingsUiStale,
      cancelMutation,
      handleCancelBooking,
    ],
  );

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

          <section {...tabPanelProps("rooms")}>
            <RoomsTab {...roomsTabProps} />
          </section>

          <section {...tabPanelProps("schedule")}>
            <ScheduleTab {...scheduleTabProps} />
          </section>

          <section {...tabPanelProps("mine")}>
            <MyBookingsTab {...myBookingsTabProps} />
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
