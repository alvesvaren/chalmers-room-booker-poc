import type { UseMutationResult } from "@tanstack/react-query";
import type {
  AllRoomsBookings,
  MyBooking,
  Room,
  RoomWithReservations,
} from "../client/types.gen";
import type { RoomSort } from "../lib/roomSort";
import type { TimeInterval } from "../lib/weekTimeline";

export type RoomsTabData = {
  rooms: Room[] | undefined;
  bookings: AllRoomsBookings | undefined;
  bookingsWeekStart: Date;
  bookingsWeekEnd: Date;
};

export type RoomsTabStatus = {
  roomsIsFetching: boolean;
  roomsUiStale: boolean;
  bookingsIsFetching: boolean;
  bookingsUiStale: boolean;
};

export type RoomsTabFilters = {
  qFilter: string;
  onQFilter: (v: string) => void;
  capacityBounds: { min: number; max: number };
  capacityMin: number;
  capacityMax: number;
  onCapacityRangeChange: (next: { min: number; max: number }) => void;
  roomSort: RoomSort;
  onRoomSortChange: (next: RoomSort) => void;
};

export type RoomsTabActions = {
  onRoomsAvailabilityDateChange: (date: string | null) => void;
  onBookRoom: (
    room: Room,
    slot?: { date: string; startTime: string; endTime: string },
  ) => void;
  isRoomBookable: (room: Room) => boolean;
};

export type RoomsTabProps = {
  data: RoomsTabData;
  status: RoomsTabStatus;
  filters: RoomsTabFilters;
  actions: RoomsTabActions;
  isTabActive: boolean;
};

export type ScheduleTabWeek = {
  weekOffset: number;
  onWeekOffsetChange: (n: number) => void;
};

export type ScheduleTabFilters = {
  qFilter: string;
  onQFilter: (v: string) => void;
  capacityBounds: { min: number; max: number };
  capacityMin: number;
  capacityMax: number;
  onCapacityRangeChange: (next: { min: number; max: number }) => void;
  roomSort: RoomSort;
  onRoomSortChange: (next: RoomSort) => void;
};

export type ScheduleTabBookings = {
  bookings: AllRoomsBookings | undefined;
  bookingsIsFetching: boolean;
  bookingsUiStale: boolean;
  bookingsFailed?: boolean;
  myBookings: MyBooking[] | undefined;
  myBookingsUiStale: boolean;
};

export type ScheduleTabActions = {
  onPickFree: (room: RoomWithReservations, gap: TimeInterval) => void;
  onBookRoom: (room: RoomWithReservations) => void;
};

export type ScheduleTabProps = {
  week: ScheduleTabWeek;
  filters: ScheduleTabFilters;
  bookings: ScheduleTabBookings;
  actions: ScheduleTabActions;
  isTabActive: boolean;
};

export type MyBookingsTabData = {
  rooms: Room[] | undefined;
  myBookings: MyBooking[] | undefined;
};

export type MyBookingsTabStatus = {
  loadPending?: boolean;
  uiStale?: boolean;
  cancelError: unknown | null;
};

export type MyBookingsTabActions = {
  onCancelRequest: (id: string) => void;
  cancelMutation: Pick<UseMutationResult, "isPending">;
};

export type MyBookingsTabProps = {
  data: MyBookingsTabData;
  status: MyBookingsTabStatus;
  actions: MyBookingsTabActions;
};
