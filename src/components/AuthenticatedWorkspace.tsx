import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  CreateBookingRequest,
  Room,
  RoomWithReservations,
} from "../client/types.gen";
import { TOAST_DURATION_MS } from "../config/api";
import { useAutoDismiss } from "../hooks/useUiEffects";
import { useWorkspaceBookingsMutations } from "../hooks/useWorkspaceBookingsMutations";
import { useWorkspaceServerData } from "../hooks/useWorkspaceServerData";
import {
  clampIntervalToDayWindow,
  dayDisplayBounds,
  defaultAvailabilityFilterStartTime,
} from "../lib/bookingSheetMath";
import { CAPACITY_SLIDER_FALLBACK_MAX } from "../lib/capacityBounds";
import { findAbRoomCompanion } from "../lib/abRoomPair";
import type { RoomSort } from "../lib/roomSort";
import { errorMessage } from "../lib/errors";
import { roomWithBookingsFor } from "../lib/roomSchedule";
import type { TimeInterval } from "../lib/weekTimeline";
import {
  addMinutes,
  firstFreeGapInWeek,
  formatLocalDate,
  formatLocalTime,
  formatWeekRangeLabel,
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
  FreeAtTimeFilterProps,
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
  const [qFilter, setQFilter] = useState("");
  const [roomSort, setRoomSort] = useState<RoomSort>({
    mode: "rating",
    invert: false,
  });
  const [capacityRange, setCapacityRange] = useState({
    min: 1,
    max: CAPACITY_SLIDER_FALLBACK_MAX,
  });
  const [activeTab, setActiveTab] = useState<AppTabId>("rooms");
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingInitial, setBookingInitial] =
    useState<BookingSheetInitial | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const effectiveBookingsWeekOffset = slotFilterActive
    ? weekOffsetForLocalDate(slotDate)
    : weekOffset;

  const bookingsRequestQuery = useMemo(() => {
    const q = qFilter.trim();
    const base: { weekOffset: string; q?: string } = {
      weekOffset: String(effectiveBookingsWeekOffset),
    };
    if (q) base.q = q;
    return base;
  }, [effectiveBookingsWeekOffset, qFilter]);

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
    },
    [
      applyDefaultSlotIntervalForDate,
      slotDate,
      slotStartTime,
      slotEndTime,
    ],
  );

  const setSlotDateSynced = useCallback(
    (nextDate: string) => {
      setSlotDate(nextDate);
      applyDefaultSlotIntervalForDate(nextDate);
    },
    [applyDefaultSlotIntervalForDate],
  );

  const crossesDayUi = useMemo(() => {
    if (!slotFilterActive) return false;
    const start = parseInstantOnDate(slotDate, slotStartTime);
    const end = parseInstantOnDate(slotDate, slotEndTime);
    return (
      formatLocalDate(end) !== slotDate || end.getTime() <= start.getTime()
    );
  }, [slotFilterActive, slotDate, slotStartTime, slotEndTime]);

  const slotIntervalForFilter = useMemo(() => {
    if (!slotFilterActive) return null;
    const start = parseInstantOnDate(slotDate, slotAppliedStart);
    const end = parseInstantOnDate(slotDate, slotAppliedEnd);
    const crossesDay =
      formatLocalDate(end) !== slotDate || end.getTime() <= start.getTime();
    if (crossesDay) return null;
    return { start, end };
  }, [slotFilterActive, slotDate, slotAppliedStart, slotAppliedEnd]);

  const bookingsWeekLabel = formatWeekRangeLabel(weekStart, weekEnd);

  const freeAtTimeFilter: FreeAtTimeFilterProps = useMemo(
    () => ({
      active: slotFilterActive,
      onActiveChange: setSlotFilterActiveSynced,
      minBookDate,
      slotDate,
      onSlotDateChange: setSlotDateSynced,
      slotStartTime,
      slotEndTime,
      onSlotIntervalChange: ({ startTime: st, endTime: et }) => {
        setSlotStartTime(st);
        setSlotEndTime(et);
      },
      crossesDayUi,
      bookingsWeekLabel,
      showBookingsWeekFetching:
        slotFilterActive && bookingsGrid == null && bookingsQuery.isFetching,
      filterInterval: slotIntervalForFilter,
    }),
    [
      slotFilterActive,
      setSlotFilterActiveSynced,
      minBookDate,
      slotDate,
      setSlotDateSynced,
      slotStartTime,
      slotEndTime,
      crossesDayUi,
      bookingsWeekLabel,
      bookingsGrid,
      bookingsQuery.isFetching,
      slotIntervalForFilter,
    ],
  );

  const runBookingsFilterUpdate = useCallback(
    (update: () => void) => {
      startFilterTransition(update);
    },
    [startFilterTransition],
  );

  const setQFilterTransitioned = useCallback(
    (v: string) => runBookingsFilterUpdate(() => setQFilter(v)),
    [runBookingsFilterUpdate],
  );

  const setRoomSortTransitioned = useCallback(
    (next: RoomSort) => runBookingsFilterUpdate(() => setRoomSort(next)),
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
      if (slotFilterActive && !crossesDayUi) {
        const start = parseInstantOnDate(slotDate, slotStartTime);
        const end = parseInstantOnDate(slotDate, slotEndTime);
        if (
          !roomAvailableForInterval(
            room,
            weekStart,
            weekEnd,
            slotDate,
            start,
            end,
          )
        ) {
          return;
        }
        openBookingSheet({
          roomId: room.id,
          roomName: room.name,
          date: slotDate,
          startTime: slotStartTime,
          endTime: slotEndTime,
        });
        return;
      }
      const gap = firstFreeGapInWeek(room, weekStart, weekEnd);
      if (!gap) return;
      openBookingSheet(toBookingDraft(room.id, room.name, gap));
    },
    [
      openBookingSheet,
      weekStart,
      weekEnd,
      slotFilterActive,
      crossesDayUi,
      slotDate,
      slotStartTime,
      slotEndTime,
    ],
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
        const companion = findAbRoomCompanion(room, roomsQuery.data);
        let initial: BookingSheetInitial = {
          roomId: room.id,
          roomName: room.name,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
        if (companion) {
          const rwCompanion = roomWithBookingsFor(
            companion,
            bookingsGrid.rooms,
          );
          if (
            roomAvailableForInterval(
              rwCompanion,
              weekStart,
              weekEnd,
              slot.date,
              start,
              end,
            )
          ) {
            initial = {
              ...initial,
              companionRoomId: companion.id,
              companionRoomName: companion.name,
            };
          }
        }
        openBookingSheet(initial);
        return;
      }
      const gap = firstFreeGapInWeek(rw, weekStart, weekEnd);
      if (!gap) return;
      openBookingSheet(toBookingDraft(room.id, room.name, gap));
    },
    [bookingsGrid, openBookingSheet, weekStart, weekEnd, roomsQuery.data],
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
      if (slotFilterActive) {
        if (!slotIntervalForFilter || crossesDayUi) return false;
        return roomAvailableForInterval(
          rw,
          weekStart,
          weekEnd,
          slotDate,
          slotIntervalForFilter.start,
          slotIntervalForFilter.end,
        );
      }
      return firstFreeGapInWeek(rw, weekStart, weekEnd) != null;
    },
    [
      bookingsGrid,
      weekStart,
      weekEnd,
      slotFilterActive,
      slotIntervalForFilter,
      crossesDayUi,
      slotDate,
    ],
  );

  const onWeekNavigate = useCallback((next: number) => {
    setSlotFilterActive(false);
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
    async (
      primary: CreateBookingRequest,
      companion?: CreateBookingRequest,
    ) => {
      try {
        if (companion) {
          const [first, second] = await Promise.all([
            createBookingMutation.mutateAsync({ body: primary }),
            createBookingMutation.mutateAsync({ body: companion }),
          ]);
          closeBookingSheet();
          showBookingToast(
            t("booking.createdToastDual", {
              idA: first.booking.id,
              idB: second.booking.id,
            }),
          );
          return;
        }
        const first = await createBookingMutation.mutateAsync({
          body: primary,
        });
        closeBookingSheet();
        showBookingToast(
          t("booking.createdToast", { id: first.booking.id }),
        );
      } catch {
        /* TanStack Query surfaces mutation errors on the sheet */
      }
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
        qFilter,
        onQFilter: setQFilterTransitioned,
        capacityBounds,
        capacityMin: capacityDisplay.min,
        capacityMax: capacityDisplay.max,
        onCapacityRangeChange: setCapacityRange,
        roomSort,
        onRoomSortChange: setRoomSortTransitioned,
        freeAtTime: freeAtTimeFilter,
      },
      actions: {
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
      qFilter,
      setQFilterTransitioned,
      roomSort,
      setRoomSortTransitioned,
      capacityBounds,
      capacityDisplay.min,
      capacityDisplay.max,
      handleBookRoomFromDirectory,
      isRoomBookable,
      activeTab,
      freeAtTimeFilter,
    ],
  );

  const scheduleTabProps: ScheduleTabProps = useMemo(
    () => ({
      week: {
        weekOffset,
        onWeekOffsetChange: onWeekNavigate,
      },
      filters: {
        qFilter,
        onQFilter: setQFilterTransitioned,
        capacityBounds,
        capacityMin: capacityDisplay.min,
        capacityMax: capacityDisplay.max,
        onCapacityRangeChange: setCapacityRange,
        roomSort,
        onRoomSortChange: setRoomSortTransitioned,
        freeAtTime: freeAtTimeFilter,
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
      weekOffset,
      onWeekNavigate,
      qFilter,
      setQFilterTransitioned,
      roomSort,
      setRoomSortTransitioned,
      capacityBounds,
      capacityDisplay.min,
      capacityDisplay.max,
      freeAtTimeFilter,
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
          {workspaceError && (
            <div
              className="border-te-danger/30 bg-te-danger-bg text-te-danger mb-6 rounded-xl border px-4 py-3 text-sm"
              role="alert"
            >
              {errorMessage(workspaceError)}
            </div>
          )}

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
        allRooms={roomsQuery.data}
        scheduleRooms={bookingsGrid?.rooms}
        myBookings={myBookingsQuery.data}
        onSubmit={submitBooking}
        isPending={createBookingMutation.isPending}
        error={
          createBookingMutation.isError ? createBookingMutation.error : null
        }
      />

      {toast && (
        <div
          className="border-te-border bg-te-elevated text-te-text fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
