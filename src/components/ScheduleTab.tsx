import { useId, useMemo, useState } from 'react'
import type {
  AllRoomsBookings,
  Booking,
  RoomWithBookings,
} from '../client/types.gen'
import type { UseQueryResult } from '@tanstack/react-query'
import {
  getWeekRange,
  formatWeekRangeLabel,
  type TimeInterval,
} from '../lib/weekTimeline'
import { errorMessage } from '../lib/errors'
import { ratingSortValue } from '../lib/roomRatings'
import { Button } from './ui/Button'
import { Skeleton } from './ui/Skeleton'
import { RoomWeekCard } from './RoomWeekCard'

/** Motsvarar layouten i RoomWeekCard (header + veckorader med tidslinje). */
function ScheduleWeekCardSkeleton({ dayPattern }: { dayPattern: number }) {
  const barMasks: [number, number][] =
    dayPattern % 3 === 0
      ? [
          [6, 20],
          [38, 24],
          [72, 18],
        ]
      : dayPattern % 3 === 1
        ? [
            [10, 28],
            [52, 15],
          ]
        : [
            [4, 12],
            [28, 40],
            [85, 10],
          ]

  return (
    <article
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-te-border bg-te-elevated shadow-sm"
      aria-hidden
    >
      <div className="flex flex-col gap-3 border-b border-te-border/80 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-7 w-3/5 max-w-xs rounded-md" />
          <Skeleton className="h-3.5 w-full max-w-sm rounded" />
        </div>
        <Skeleton className="h-10 w-full shrink-0 rounded-lg sm:w-28" />
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="ml-12 hidden justify-between sm:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-6 rounded-full opacity-60" />
          ))}
        </div>

        {Array.from({ length: 7 }).map((_, dayIdx) => {
          const segments =
            (dayPattern + dayIdx) % 3 === 1
              ? barMasks.slice(0, 2)
              : barMasks
          return (
            <div
              key={dayIdx}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr] sm:items-center"
            >
              <Skeleton className="h-4 w-24 rounded sm:w-14" />
              <div className="relative h-9 overflow-hidden rounded-lg bg-te-border/20">
                {segments.map(([left, width], j) => (
                  <Skeleton
                    key={j}
                    className="absolute inset-y-1 rounded-sm opacity-75"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <Skeleton className="mx-auto h-3 w-full max-w-xl rounded opacity-50" />
      </div>
    </article>
  )
}

export function ScheduleTab({
  weekOffset,
  onWeekOffsetChange,
  campusFilter,
  onCampusFilter,
  qFilter,
  onQFilter,
  bookingsQuery,
  myBookings,
  onPickFree,
  onBookRoom,
}: {
  weekOffset: number
  onWeekOffsetChange: (n: number) => void
  campusFilter: string
  onCampusFilter: (v: string) => void
  qFilter: string
  onQFilter: (v: string) => void
  bookingsQuery: UseQueryResult<AllRoomsBookings, unknown>
  myBookings: Booking[] | undefined
  onPickFree: (room: RoomWithBookings, gap: TimeInterval) => void
  onBookRoom: (room: RoomWithBookings) => void
}) {
  const rulesId = useId()
  const [rulesOpen, setRulesOpen] = useState(false)
  const { weekStart, weekEnd } = getWeekRange(weekOffset)
  const label = formatWeekRangeLabel(weekStart, weekEnd)

  const roomsSorted = useMemo(() => {
    const rooms = [...(bookingsQuery.data?.rooms ?? [])]
    rooms.sort((a, b) => {
      const cmp = ratingSortValue(b.name) - ratingSortValue(a.name)
      if (cmp !== 0) return cmp
      return a.name.localeCompare(b.name, 'sv')
    })
    return rooms
  }, [bookingsQuery.data?.rooms])

  const filterGrid = 'grid w-full grid-cols-1 gap-3 sm:grid-cols-2'
  const inputClass =
    'min-w-0 w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2.5 text-sm text-te-text outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:py-2'
  const scheduleGridClass =
    'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]'

  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-te-text">
            Veckoschema
          </h2>
          <p className="mt-1 text-sm text-te-muted">{label}</p>
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

      <div className={filterGrid}>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Campus (filtrera)</span>
          <input
            className={inputClass}
            value={campusFilter}
            onChange={(e) => onCampusFilter(e.target.value)}
            placeholder="Johanneberg"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Rumsnamn</span>
          <input
            className={inputClass}
            value={qFilter}
            onChange={(e) => onQFilter(e.target.value)}
            placeholder="KG"
          />
        </label>
      </div>

      {bookingsQuery.isError ? (
        <p className="text-sm text-te-danger">{errorMessage(bookingsQuery.error)}</p>
      ) : null}

      {bookingsQuery.isLoading ? (
        <div
          className="space-y-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="text-sm text-te-muted">
            <span className="font-display font-semibold text-te-text">
              Laddar veckoschema
            </span>{' '}
            för{' '}
            <span className="font-medium tabular-nums text-te-text/95">
              {label}
            </span>
            …
          </p>
          <div className={scheduleGridClass}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ScheduleWeekCardSkeleton key={i} dayPattern={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {bookingsQuery.data?.errors?.length ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
              <p className="font-medium">Delvisa fel</p>
              <ul className="mt-1 list-inside list-disc">
                {bookingsQuery.data.errors.map((e) => (
                  <li key={e.roomId}>
                    {e.roomId}: {e.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {bookingsQuery.data?.bookingRules ? (
            <div className="rounded-xl border border-te-border bg-te-surface">
              <button
                type="button"
                id={rulesId}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-te-text"
                aria-expanded={rulesOpen}
                onClick={() => setRulesOpen((o) => !o)}
              >
                Bokningsregler
                <span className="text-te-muted">{rulesOpen ? '▼' : '►'}</span>
              </button>
              {rulesOpen ? (
                <div className="max-h-48 overflow-y-auto border-t border-te-border px-4 py-3 text-sm leading-relaxed text-te-muted">
                  {bookingsQuery.data.bookingRules}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={scheduleGridClass}>
            {roomsSorted.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-te-border bg-te-elevated/50 px-4 py-12 text-center text-sm text-te-muted">
                Inga rum för denna filtrering.
              </div>
            ) : (
              roomsSorted.map((room) => (
                <RoomWeekCard
                  key={room.id}
                  room={room}
                  weekStart={weekStart}
                  weekEndExclusive={weekEnd}
                  onPickFree={onPickFree}
                  onBookRoom={onBookRoom}
                  myBookings={myBookings}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
