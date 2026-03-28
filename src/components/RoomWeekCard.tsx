import { useState } from 'react'
import type { RoomWithBookings } from '../client/types.gen'
import { getRoomRating } from '../lib/roomRatings'
import {
  buildRoomWeekTimeline,
  formatLocalDate,
  formatLocalTime,
  type TimeInterval,
  intervalToPercent,
} from '../lib/weekTimeline'
import { Button } from './ui/Button'

export function RoomWeekCard({
  room,
  weekStart,
  weekEndExclusive,
  onPickFree,
  onBookRoom,
}: {
  room: RoomWithBookings
  weekStart: Date
  weekEndExclusive: Date
  onPickFree: (room: RoomWithBookings, gap: TimeInterval) => void
  onBookRoom: (room: RoomWithBookings) => void
}) {
  const [open, setOpen] = useState(true)
  const days = buildRoomWeekTimeline(room, weekStart, weekEndExclusive)
  const rr = getRoomRating(room.name)

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-te-border bg-te-elevated shadow-sm transition-[box-shadow] duration-200 hover:border-te-accent/25 hover:shadow-md">
      <div className="flex flex-col gap-3 border-b border-te-border/80 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={
            open
              ? `Dölj tidslinje för ${room.name}`
              : `Visa tidslinje för ${room.name}`
          }
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-te-muted">
            Grupprum
          </p>
          <span className="mt-1.5 block font-display text-lg font-semibold leading-tight tracking-tight text-te-text sm:text-xl">
            {room.name}
          </span>
          <span className="mt-2 block text-sm text-te-muted">
            <span className="font-medium text-te-text/90">{room.campus}</span>
            <span
              aria-hidden
              className="mx-2 inline-block h-3 w-px translate-y-px bg-te-border align-middle"
            />
            <span className="tabular-nums">{room.capacity ?? '—'} platser</span>
            {rr != null ? (
              <>
                <span
                  aria-hidden
                  className="mx-2 inline-block h-3 w-px translate-y-px bg-te-border align-middle"
                />
                <span
                  className="cursor-help font-display text-base font-semibold tabular-nums text-te-accent"
                  title={rr.comment}
                >
                  {rr.overall.toLocaleString('sv-SE', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  <span className="ml-1 font-sans text-xs font-medium text-te-muted">
                    betyg
                  </span>
                </span>
              </>
            ) : null}
          </span>
        </button>
        <Button
          variant="primary"
          className="w-full shrink-0 touch-manipulation py-2.5 text-sm font-semibold sm:w-auto sm:px-5"
          onClick={() => onBookRoom(room)}
        >
          Boka
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="ml-12 hidden justify-between text-[10px] font-medium uppercase tracking-wider text-te-muted sm:flex">
            <span>07</span>
            <span>10</span>
            <span>13</span>
            <span>16</span>
            <span>19</span>
            <span>22</span>
          </div>

          {days.map((day) => (
            <div
              key={day.dateStr}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr] sm:items-center"
            >
              <div className="text-xs font-medium capitalize text-te-muted sm:w-14">
                <span className="sm:hidden text-te-text">
                  {day.weekdayShort} {formatLocalDate(day.date)}{' '}
                </span>
                <span className="hidden sm:inline">{day.weekdayShort}</span>
              </div>
              <div className="relative h-9 overflow-hidden rounded-lg bg-te-border/25">
                {day.free.map((g, i) => {
                  const { leftPct, widthPct } = intervalToPercent(
                    g,
                    day.displayStart,
                    day.displayEnd,
                  )
                  const label = `${formatLocalTime(g.start)}–${formatLocalTime(g.end)}`
                  return (
                    <button
                      key={`f-${i}`}
                      type="button"
                      title={`Book ${label}`}
                      className="absolute inset-y-1 z-0 rounded border border-te-accent/25 bg-te-free-hover hover:bg-te-accent-muted"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 1.2)}%`,
                      }}
                      onClick={() => onPickFree(room, g)}
                    />
                  )
                })}
                {day.busy.map((b, i) => {
                  const { leftPct, widthPct } = intervalToPercent(
                    b,
                    day.displayStart,
                    day.displayEnd,
                  )
                  return (
                    <div
                      key={`b-${i}`}
                      title={b.label ? `Upptagen · ${b.label}` : 'Upptagen'}
                      className="pointer-events-none absolute inset-y-1 z-10 rounded-sm bg-te-busy-strong/85 shadow-inner"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 0.6)}%`,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          <p className="text-[11px] text-te-muted">
            Grön = ledig tid (klicka för att boka). Grå block = upptaget.
          </p>

          <ul className="sr-only">
            {days.flatMap((d) =>
              d.busy.map((b, j) => (
                <li key={`${d.dateStr}-${j}`}>
                  {d.weekdayShort} {formatLocalTime(b.start)} till{' '}
                  {formatLocalTime(b.end)}
                  {b.label ? `, ${b.label}` : ''}
                </li>
              )),
            )}
          </ul>
        </div>
      ) : null}
    </article>
  )
}
