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
    <article className="overflow-hidden rounded-xl border border-te-border bg-te-elevated shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-te-border/80 px-4 py-3 sm:px-5">
        <button
          type="button"
          className="min-w-0 flex-1 text-left font-medium text-te-text"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="font-display">{room.name}</span>
          <span className="mt-0.5 block text-sm font-normal text-te-muted">
            {room.campus} · {room.capacity ?? '—'} platser
            {rr != null ? (
              <>
                {' · '}
                <span
                  className="cursor-help border-b border-dotted border-te-muted/80 text-te-text"
                  title={rr.comment}
                >
                  Betyg{' '}
                  {rr.overall.toLocaleString('sv-SE', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
              </>
            ) : null}
          </span>
        </button>
        <Button
          variant="secondary"
          className="shrink-0 text-xs"
          onClick={() => onBookRoom(room)}
        >
          Book room
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
