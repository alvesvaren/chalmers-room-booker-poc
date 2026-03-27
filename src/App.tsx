import {
  deleteApiMyBookingsByIdMutation,
  getApiBookingsOptions,
  getApiMyBookingsOptions,
  getApiMyBookingsQueryKey,
  getApiRoomsOptions,
  postApiAuthLoginMutation,
  postApiMyBookingsMutation,
} from './client/@tanstack/react-query.gen'
import { client } from './client/client.gen'
import type { Query } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Room, RoomWithBookings } from './client/types.gen'
import { AppTabs, type AppTabId } from './components/AppTabs'
import { BookingSheet, type BookingSheetInitial } from './components/BookingSheet'
import { MyBookingsTab } from './components/MyBookingsTab'
import { RoomsTab } from './components/RoomsTab'
import { ScheduleTab } from './components/ScheduleTab'
import { SignInPanel } from './components/SignInPanel'
import {
  firstFreeGapInWeek,
  getWeekRange,
  toBookingDraft,
} from './lib/weekTimeline'
import type { TimeInterval } from './lib/weekTimeline'

const STORAGE_KEY = 'timeedit-demo-jwt'
export const API_BASE = 'https://timeedit-api-wrapper.vercel.app'

function bookingsGridPredicate(q: Query) {
  const head = q.queryKey[0]
  return (
    head !== null &&
    typeof head === 'object' &&
    '_id' in head &&
    (head as { _id: string })._id === 'getApiBookings'
  )
}

function roomWithBookingsFor(
  room: Room,
  scheduleRooms: RoomWithBookings[] | undefined,
): RoomWithBookings {
  const hit = scheduleRooms?.find((r) => r.id === room.id)
  if (hit) return hit
  return {
    ...room,
    bookings: [],
  }
}

export default function App() {
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [campusFilter, setCampusFilter] = useState('')
  const [qFilter, setQFilter] = useState('')
  const [activeTab, setActiveTab] = useState<AppTabId>('schedule')
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false)
  const [bookingInitial, setBookingInitial] =
    useState<BookingSheetInitial | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const authed = Boolean(token)

  useEffect(() => {
    client.setConfig({
      baseUrl: API_BASE,
      auth: () => token || undefined,
    })
    try {
      if (token) sessionStorage.setItem(STORAGE_KEY, token)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore storage */
    }
  }, [token])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  const loginMutation = useMutation({
    ...postApiAuthLoginMutation(),
  })

  const roomsQuery = useQuery({
    ...getApiRoomsOptions(),
    enabled: authed,
  })

  const bookingsQuery = useQuery({
    ...getApiBookingsOptions({
      query: {
        weekOffset: String(weekOffset),
        campus: campusFilter.trim() || undefined,
        q: qFilter.trim() || undefined,
      },
    }),
    enabled: authed,
  })

  const myBookingsQuery = useQuery({
    ...getApiMyBookingsOptions(),
    enabled: authed,
  })

  const createBookingMutation = useMutation({
    ...postApiMyBookingsMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMyBookingsQueryKey(),
      })
      await queryClient.invalidateQueries({ predicate: bookingsGridPredicate })
    },
  })

  const cancelMutation = useMutation({
    ...deleteApiMyBookingsByIdMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMyBookingsQueryKey(),
      })
      await queryClient.invalidateQueries({ predicate: bookingsGridPredicate })
    },
  })

  function logOut() {
    setToken('')
    void queryClient.invalidateQueries()
    void queryClient.clear()
  }

  const { weekStart, weekEnd } = getWeekRange(weekOffset)

  function openBookingSheet(initial: BookingSheetInitial) {
    createBookingMutation.reset()
    setBookingInitial(initial)
    setBookingSheetOpen(true)
  }

  function handlePickFree(room: RoomWithBookings, gap: TimeInterval) {
    openBookingSheet(toBookingDraft(room.id, room.name, gap))
  }

  function handleBookRoomFromSchedule(room: RoomWithBookings) {
    const gap = firstFreeGapInWeek(room, weekStart, weekEnd)
    if (!gap) return
    openBookingSheet(toBookingDraft(room.id, room.name, gap))
  }

  function handleBookRoomFromDirectory(room: Room) {
    const rw = roomWithBookingsFor(room, bookingsQuery.data?.rooms)
    const gap = firstFreeGapInWeek(rw, weekStart, weekEnd)
    if (!gap) return
    openBookingSheet(toBookingDraft(room.id, room.name, gap))
  }

  function handleCancelBooking(id: string) {
    if (!window.confirm('Avboka denna reservation?')) return
    cancelMutation.mutate({ path: { id } })
  }

  return (
    <div className="min-h-svh antialiased text-te-text">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="te-reveal mb-8 border-b border-te-border pb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-te-text sm:text-4xl">
            TimeEdit demo
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-te-muted">
            Grupprumsbokning via TimeEdit. Logga in med ditt Chalmers-konto.
          </p>
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
                onSuccess: (data) => {
                  setToken(data.token)
                  setPassword('')
                },
              },
            )
          }}
          onLogOut={logOut}
          isPending={loginMutation.isPending}
          submitError={loginMutation.isError ? loginMutation.error : null}
        />

        {toast ? (
          <div
            className="fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-xl border border-te-border bg-te-elevated px-4 py-3 text-sm text-te-text shadow-lg"
            role="status"
            aria-live="polite"
          >
            {toast}
          </div>
        ) : null}

        {!authed ? (
          <p className="mt-8 text-center text-sm text-te-muted">
            Logga in för att se schema, rum och dina bokningar.
          </p>
        ) : (
          <div className="mt-10 space-y-6">
            <AppTabs active={activeTab} onChange={setActiveTab} />

            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              className="rounded-2xl border border-te-border bg-te-surface p-5 shadow-sm sm:p-8"
            >
              {activeTab === 'schedule' ? (
                <ScheduleTab
                  weekOffset={weekOffset}
                  onWeekOffsetChange={setWeekOffset}
                  campusFilter={campusFilter}
                  onCampusFilter={setCampusFilter}
                  qFilter={qFilter}
                  onQFilter={setQFilter}
                  bookingsQuery={bookingsQuery}
                  onPickFree={handlePickFree}
                  onBookRoom={handleBookRoomFromSchedule}
                />
              ) : null}
              {activeTab === 'rooms' ? (
                <RoomsTab
                  roomsQuery={roomsQuery}
                  onBookRoom={handleBookRoomFromDirectory}
                />
              ) : null}
              {activeTab === 'mine' ? (
                <MyBookingsTab
                  myBookingsQuery={myBookingsQuery}
                  cancelMutation={cancelMutation}
                  onCancelRequest={handleCancelBooking}
                  cancelError={
                    cancelMutation.isError ? cancelMutation.error : null
                  }
                />
              ) : null}
            </div>
          </div>
        )}

        <footer className="mt-16 border-t border-te-border pt-6 text-center text-xs text-te-muted">
          <a
            className="font-medium text-te-accent underline-offset-4 hover:underline"
            href={API_BASE}
            target="_blank"
            rel="noreferrer"
          >
            API-wrapper
          </a>
        </footer>
      </div>

      <BookingSheet
        open={bookingSheetOpen}
        onClose={() => {
          setBookingSheetOpen(false)
          setBookingInitial(null)
          createBookingMutation.reset()
        }}
        initial={bookingInitial}
        onSubmit={(body) =>
          createBookingMutation.mutate(
            { body },
            {
              onSuccess: (data) => {
                setBookingSheetOpen(false)
                setBookingInitial(null)
                setToast(`Bokning skapad · ${data.booking.id}`)
                createBookingMutation.reset()
              },
            },
          )
        }
        isPending={createBookingMutation.isPending}
        error={createBookingMutation.isError ? createBookingMutation.error : null}
      />
    </div>
  )
}
