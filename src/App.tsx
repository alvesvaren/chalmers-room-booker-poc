import type { Query } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteApiMyBookingsByIdMutation,
  getApiBookingsOptions,
  getApiMyBookingsOptions,
  getApiMyBookingsQueryKey,
  getApiRoomsOptions,
  postApiAuthLoginMutation,
  postApiMyBookingsMutation,
} from "./client/@tanstack/react-query.gen";
import { client } from "./client/client.gen";
import type { Room, RoomWithBookings } from "./client/types.gen";
import { AppTabs, type AppTabId } from "./components/AppTabs";
import { BookingSheet, type BookingSheetInitial } from "./components/BookingSheet";
import { MyBookingsTab } from "./components/MyBookingsTab";
import { RoomsTab } from "./components/RoomsTab";
import { ScheduleTab } from "./components/ScheduleTab";
import { SignInPanel } from "./components/SignInPanel";
import { CAPACITY_SLIDER_FALLBACK_MAX, capacitySliderBounds } from "./lib/capacityBounds";
import type { TimeInterval } from "./lib/weekTimeline";
import { firstFreeGapInWeek, getWeekRange, roomAvailableForInterval, toBookingDraft, weekOffsetForLocalDate } from "./lib/weekTimeline";

const STORAGE_KEY = "timeedit-demo-jwt";
export const API_BASE = "https://timeedit.svaren.dev";
const AUTH_LOGIN_PATH = "/api/auth/login";

function clampInt(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function bookingsGridPredicate(q: Query) {
  const head = q.queryKey[0];
  return head !== null && typeof head === "object" && "_id" in head && (head as { _id: string })._id === "getApiBookings";
}

function roomWithBookingsFor(room: Room, scheduleRooms: RoomWithBookings[] | undefined): RoomWithBookings {
  const hit = scheduleRooms?.find(r => r.id === room.id);
  if (hit) return hit;
  return {
    ...room,
    bookings: [],
  };
}

export default function App() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [campusFilter, setCampusFilter] = useState("");
  const [qFilter, setQFilter] = useState("");
  const [capacityRange, setCapacityRange] = useState({ min: 1, max: CAPACITY_SLIDER_FALLBACK_MAX });
  const [activeTab, setActiveTab] = useState<AppTabId>("schedule");
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingInitial, setBookingInitial] = useState<BookingSheetInitial | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** When set, /api/bookings uses this date's week; Rum-tab slot filter owns lifecycle. */
  const [roomsAvailabilityDate, setRoomsAvailabilityDate] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const authed = Boolean(token);
  const tokenRef = useRef(token);
  const authFailureLogoutScheduled = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
    if (token) authFailureLogoutScheduled.current = false;
  }, [token]);

  const logOut = useCallback(() => {
    setToken("");
    void queryClient.invalidateQueries();
    void queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const id = client.interceptors.response.use(async (response, request) => {
      const path = new URL(request.url).pathname;
      const isLogin = path === AUTH_LOGIN_PATH || path.endsWith(AUTH_LOGIN_PATH);
      const hadToken = Boolean(tokenRef.current);

      if (response.status === 401 && !isLogin && hadToken) {
        if (!authFailureLogoutScheduled.current) {
          authFailureLogoutScheduled.current = true;
          logOut();
          setToast("Sessionen har gått ut eller är ogiltig. Logga in igen.");
        }
        return response;
      }

      if (response.status === 502 && !isLogin && hadToken) {
        try {
          const text = await response.clone().text();
          const body = JSON.parse(text) as { error?: string };
          if (body.error === "TimeEdit authentication failed" && !authFailureLogoutScheduled.current) {
            authFailureLogoutScheduled.current = true;
            logOut();
            setToast("TimeEdit accepterade inte inloggningen. Logga in igen.");
          }
        } catch {
          /* ignore parse errors */
        }
      }

      return response;
    });
    return () => client.interceptors.response.eject(id);
  }, [logOut]);

  useEffect(() => {
    client.setConfig({
      baseUrl: API_BASE,
      auth: () => token || undefined,
    });
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage */
    }
  }, [token]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loginMutation = useMutation({
    ...postApiAuthLoginMutation(),
  });

  const roomsQuery = useQuery({
    ...getApiRoomsOptions(),
    enabled: authed,
  });

  const capacityBounds = useMemo(() => capacitySliderBounds(roomsQuery.data), [roomsQuery.data]);

  const displayCapacityRange = useMemo(() => {
    const lo = capacityBounds.min;
    const hi = capacityBounds.max;
    const a = clampInt(capacityRange.min, lo, hi);
    const b = clampInt(capacityRange.max, lo, hi);
    if (a > b) return { min: lo, max: hi };
    return { min: a, max: b };
  }, [capacityBounds.min, capacityBounds.max, capacityRange.min, capacityRange.max]);

  const effectiveBookingsWeekOffset = roomsAvailabilityDate != null ? weekOffsetForLocalDate(roomsAvailabilityDate) : weekOffset;

  const bookingsQuery = useQuery({
    ...getApiBookingsOptions({
      query: {
        weekOffset: String(effectiveBookingsWeekOffset),
        campus: campusFilter.trim() || undefined,
        q: qFilter.trim() || undefined,
      },
    }),
    enabled: authed,
  });

  const myBookingsQuery = useQuery({
    ...getApiMyBookingsOptions(),
    enabled: authed,
  });

  const createBookingMutation = useMutation({
    ...postApiMyBookingsMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMyBookingsQueryKey(),
      });
      await queryClient.invalidateQueries({ predicate: bookingsGridPredicate });
    },
  });

  const cancelMutation = useMutation({
    ...deleteApiMyBookingsByIdMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMyBookingsQueryKey(),
      });
      await queryClient.invalidateQueries({ predicate: bookingsGridPredicate });
    },
  });

  const { weekStart, weekEnd } = getWeekRange(effectiveBookingsWeekOffset);

  function parseInstantOnDate(dateStr: string, timeStr: string): Date {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [h, mi] = timeStr.split(":").map(Number);
    return new Date(Y, M - 1, D, h, mi ?? 0, 0, 0);
  }

  function openBookingSheet(initial: BookingSheetInitial) {
    createBookingMutation.reset();
    setBookingInitial(initial);
    setBookingSheetOpen(true);
  }

  function handlePickFree(room: RoomWithBookings, gap: TimeInterval) {
    openBookingSheet(toBookingDraft(room.id, room.name, gap));
  }

  function handleBookRoomFromSchedule(room: RoomWithBookings) {
    const gap = firstFreeGapInWeek(room, weekStart, weekEnd);
    if (!gap) return;
    openBookingSheet(toBookingDraft(room.id, room.name, gap));
  }

  function handleBookRoomFromDirectory(room: Room, slot?: { date: string; startTime: string; endTime: string }) {
    const rw = roomWithBookingsFor(room, bookingsQuery.data?.rooms);
    if (slot) {
      const start = parseInstantOnDate(slot.date, slot.startTime);
      const end = parseInstantOnDate(slot.date, slot.endTime);
      if (!roomAvailableForInterval(rw, weekStart, weekEnd, slot.date, start, end)) {
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
  }

  function handleCancelBooking(id: string) {
    if (!window.confirm("Avboka denna reservation?")) return;
    cancelMutation.mutate({ path: { id } });
  }

  const isRoomBookable = useCallback(
    (room: Room) => {
      const rw = roomWithBookingsFor(room, bookingsQuery.data?.rooms);
      return firstFreeGapInWeek(rw, weekStart, weekEnd) != null;
    },
    [bookingsQuery.data?.rooms, weekStart, weekEnd],
  );

  return (
    <div className='min-h-svh antialiased text-te-text'>
      <div className='w-full max-w-none px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12'>
        <header className='te-reveal mb-8 border-b border-te-border pb-8'>
          <h1 className='font-display text-3xl font-semibold tracking-tight text-te-text sm:text-4xl'>TimeEdit demo</h1>
          <p className='mt-2 max-w-2xl text-sm leading-relaxed text-te-muted'>Grupprumsbokning · Chalmers-inloggning.</p>
        </header>

        <SignInPanel
          authed={authed}
          username={username}
          password={password}
          onUsername={setUsername}
          onPassword={setPassword}
          onSubmit={() => {
            loginMutation.mutate(
              { body: { username, password } },
              {
                onSuccess: data => {
                  setToken(data.token);
                  setPassword("");
                },
              },
            );
          }}
          onLogOut={logOut}
          isPending={loginMutation.isPending}
          submitError={loginMutation.isError ? loginMutation.error : null}
        />

        {toast ? (
          <div
            className='fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-xl border border-te-border bg-te-elevated px-4 py-3 text-sm text-te-text shadow-lg'
            role='status'
            aria-live='polite'
          >
            {toast}
          </div>
        ) : null}

        {!authed ? (
          <p className='mt-8 text-center text-sm text-te-muted'>Logga in för att se schema, rum och dina bokningar.</p>
        ) : (
          <div className='mt-10 space-y-6'>
            <AppTabs active={activeTab} onChange={setActiveTab} />

            <div
              role='tabpanel'
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              className='rounded-2xl border border-te-border bg-te-surface p-5 shadow-sm sm:p-8'
            >
              {activeTab === "schedule" ? (
                <ScheduleTab
                  weekOffset={roomsAvailabilityDate != null ? effectiveBookingsWeekOffset : weekOffset}
                  onWeekOffsetChange={next => {
                    setRoomsAvailabilityDate(null);
                    setWeekOffset(next);
                  }}
                  campusFilter={campusFilter}
                  onCampusFilter={setCampusFilter}
                  qFilter={qFilter}
                  onQFilter={setQFilter}
                  capacityBounds={capacityBounds}
                  capacityMin={displayCapacityRange.min}
                  capacityMax={displayCapacityRange.max}
                  onCapacityRangeChange={setCapacityRange}
                  bookingsQuery={bookingsQuery}
                  myBookings={myBookingsQuery.data}
                  onPickFree={handlePickFree}
                  onBookRoom={handleBookRoomFromSchedule}
                />
              ) : null}
              {activeTab === "rooms" ? (
                <RoomsTab
                  roomsQuery={roomsQuery}
                  bookingsQuery={bookingsQuery}
                  bookingsWeekStart={weekStart}
                  bookingsWeekEnd={weekEnd}
                  onRoomsAvailabilityDateChange={setRoomsAvailabilityDate}
                  onBookRoom={handleBookRoomFromDirectory}
                  isRoomBookable={isRoomBookable}
                  capacityBounds={capacityBounds}
                  capacityMin={displayCapacityRange.min}
                  capacityMax={displayCapacityRange.max}
                  onCapacityRangeChange={setCapacityRange}
                />
              ) : null}
              {activeTab === "mine" ? (
                <MyBookingsTab
                  myBookingsQuery={myBookingsQuery}
                  cancelMutation={cancelMutation}
                  onCancelRequest={handleCancelBooking}
                  cancelError={cancelMutation.isError ? cancelMutation.error : null}
                />
              ) : null}
            </div>
          </div>
        )}

        <footer className='mt-16 border-t border-te-border pt-6 text-center text-xs text-te-muted'>
          <a className='font-medium text-te-accent underline-offset-4 hover:underline' href={API_BASE} target='_blank' rel='noreferrer'>
            API-wrapper
          </a>
        </footer>
      </div>

      <BookingSheet
        open={bookingSheetOpen}
        onClose={() => {
          setBookingSheetOpen(false);
          setBookingInitial(null);
          createBookingMutation.reset();
        }}
        initial={bookingInitial}
        scheduleRooms={bookingsQuery.data?.rooms}
        myBookings={myBookingsQuery.data}
        onSubmit={body =>
          createBookingMutation.mutate(
            { body },
            {
              onSuccess: data => {
                setBookingSheetOpen(false);
                setBookingInitial(null);
                setToast(`Bokning skapad · ${data.booking.id}`);
                createBookingMutation.reset();
              },
            },
          )
        }
        isPending={createBookingMutation.isPending}
        error={createBookingMutation.isError ? createBookingMutation.error : null}
      />
    </div>
  );
}
