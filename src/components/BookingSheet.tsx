import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CreateBookingRequest,
  RoomWithBookings,
} from '../client/types.gen'
import { errorMessage } from '../lib/errors'
import {
  DEFAULT_DAY_END_H,
  DEFAULT_DAY_START_H,
  formatLocalDate,
  formatLocalTime,
  freeSlotsInWindow,
  intervalToPercent,
  parseNaiveLocal,
  type TimeInterval,
} from '../lib/weekTimeline'
import { Button } from './ui/Button'

const MIN_DURATION_MIN = 15
const MAX_DURATION_MIN = 240
const DRAG_SNAP_MIN = 5
const DURATION_CHIPS_MIN = [15, 30, 60, 90, 120, 240] as const

function localDateTimeMs(dateStr: string, timeStr: string): number {
  const [Y, M, D] = dateStr.split('-').map(Number)
  const [hRaw, mRaw] = timeStr.trim().split(':')
  const h = Number(hRaw)
  const m = Number(mRaw ?? 0)
  if (
    !Number.isFinite(Y) ||
    !Number.isFinite(M) ||
    !Number.isFinite(D) ||
    !Number.isFinite(h) ||
    !Number.isFinite(m)
  ) {
    return NaN
  }
  return new Date(Y, M - 1, D, h, m, 0, 0).getTime()
}

function isLocalStartInPast(
  dateStr: string,
  timeStr: string,
  now: Date,
): boolean {
  const t = localDateTimeMs(dateStr, timeStr)
  if (Number.isNaN(t)) return false
  return t <= now.getTime()
}

function parseInstantOnDate(dateStr: string, timeStr: string): Date {
  const [Y, M, D] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  return new Date(Y, M - 1, D, h, mi ?? 0, 0, 0)
}

function dayDisplayBounds(dateStr: string): { start: Date; end: Date } {
  const [Y, M, D] = dateStr.split('-').map(Number)
  const day = new Date(Y, M - 1, D)
  const start = new Date(day)
  start.setHours(DEFAULT_DAY_START_H, 0, 0, 0)
  const end = new Date(day)
  end.setHours(DEFAULT_DAY_END_H, 0, 0, 0)
  return { start, end }
}

function snapMsToStep(ms: number, stepMin: number): number {
  const step = stepMin * 60_000
  return Math.round(ms / step) * step
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function intervalFitsInFreeGaps(
  s: number,
  e: number,
  gaps: TimeInterval[],
): boolean {
  if (e <= s) return false
  return gaps.some((g) => s >= g.start.getTime() && e <= g.end.getTime())
}

/** Snap interval into a single free gap; picks closest valid slot to the proposed times. */
function clampToFreeGaps(
  s: number,
  e: number,
  gaps: TimeInterval[],
  snapStepMin: number,
): [number, number] {
  const snap = (ms: number) => snapMsToStep(ms, snapStepMin)
  if (gaps.length === 0) return [snap(s), snap(e)]

  let dur = e - s
  if (dur < MIN_DURATION_MIN * 60_000) dur = MIN_DURATION_MIN * 60_000
  if (dur > MAX_DURATION_MIN * 60_000) dur = MAX_DURATION_MIN * 60_000

  let sAdj = s
  let eAdj = sAdj + dur

  if (intervalFitsInFreeGaps(sAdj, eAdj, gaps)) {
    return [snap(sAdj), snap(eAdj)]
  }

  let best: [number, number] | null = null
  let bestDist = Infinity

  for (const g of gaps) {
    const g0 = g.start.getTime()
    const g1 = g.end.getTime()
    const room = g1 - g0
    const minDur = MIN_DURATION_MIN * 60_000
    const maxDurAll = Math.min(MAX_DURATION_MIN * 60_000, room)
    if (room < minDur) continue

    const durUse = clamp(dur, minDur, maxDurAll)
    const sLo = g0
    const sHi = g1 - durUse
    if (sHi < sLo) continue

    const sClamped = clamp(sAdj, sLo, sHi)
    const eClamped = sClamped + durUse
    const dist = Math.abs(sClamped - s) + Math.abs(eClamped - e)
    if (dist < bestDist) {
      bestDist = dist
      best = [sClamped, eClamped]
    }
  }

  if (!best) return [snap(sAdj), snap(eAdj)]
  return [snap(best[0]), snap(best[1])]
}

type DragKind = 'move' | 'resize-start' | 'resize-end'

export type BookingSheetInitial = {
  roomId: string
  roomName?: string
  date: string
  startTime: string
  endTime: string
}

function BookingSheetForm({
  initial,
  scheduleRooms,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  initial: BookingSheetInitial
  scheduleRooms: RoomWithBookings[] | undefined
  onClose: () => void
  onSubmit: (body: CreateBookingRequest) => void
  isPending: boolean
  error: unknown | null
}) {
  const [roomId, setRoomId] = useState(initial.roomId)
  const roomName = initial.roomName ?? ''
  const [date, setDate] = useState(initial.date)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [title, setTitle] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const minBookDate = formatLocalDate(new Date())

  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    kind: DragKind
    originX: number
    startMs: number
    endMs: number
    pointerId: number
  } | null>(null)

  const { start: displayStart, end: displayEnd } = useMemo(
    () => dayDisplayBounds(date),
    [date],
  )

  const busyClipped = useMemo(() => {
    const slots = scheduleRooms?.find((r) => r.id === roomId)?.bookings ?? []
    return slots
      .map((slot) => {
        const a = parseNaiveLocal(slot.start)
        const b = parseNaiveLocal(slot.end)
        const t0 = Math.max(a.getTime(), displayStart.getTime())
        const t1 = Math.min(b.getTime(), displayEnd.getTime())
        if (t1 <= t0) return null
        return {
          start: new Date(t0),
          end: new Date(t1),
          label: slot.label,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
  }, [scheduleRooms, roomId, displayStart, displayEnd])

  const busyForConstraints: TimeInterval[] = useMemo(
    () => busyClipped.map((b) => ({ start: b.start, end: b.end })),
    [busyClipped],
  )

  const freeGaps = useMemo(
    () => freeSlotsInWindow(displayStart, displayEnd, busyForConstraints),
    [displayStart, displayEnd, busyForConstraints],
  )

  const freeGapsLayoutKey = useMemo(
    () => freeGaps.map((g) => `${+g.start}-${+g.end}`).join('|'),
    [freeGaps],
  )

  useEffect(() => {
    setClientError(null)
  }, [date, startTime, endTime])

  function applyIntervalClamped(startMs: number, endMs: number) {
    const [s2, e2] = clampToFreeGaps(startMs, endMs, freeGaps, DRAG_SNAP_MIN)
    setStartTime(formatLocalTime(new Date(s2)))
    setEndTime(formatLocalTime(new Date(e2)))
  }

  function commitManualTimes() {
    let s = parseInstantOnDate(date, startTime).getTime()
    let e = parseInstantOnDate(date, endTime).getTime()
    if (!Number.isFinite(s) || !Number.isFinite(e)) return
    if (e <= s) e = s + MIN_DURATION_MIN * 60_000
    let d = (e - s) / 60_000
    if (d < MIN_DURATION_MIN) e = s + MIN_DURATION_MIN * 60_000
    else if (d > MAX_DURATION_MIN) e = s + MAX_DURATION_MIN * 60_000
    applyIntervalClamped(s, e)
  }

  useEffect(() => {
    if (freeGaps.length === 0) return
    const s = parseInstantOnDate(date, startTime).getTime()
    const e = parseInstantOnDate(date, endTime).getTime()
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return
    if (intervalFitsInFreeGaps(s, e, freeGaps)) return
    const [s2, e2] = clampToFreeGaps(s, e, freeGaps, DRAG_SNAP_MIN)
    const ns = formatLocalTime(new Date(s2))
    const ne = formatLocalTime(new Date(e2))
    if (ns !== startTime || ne !== endTime) {
      setStartTime(ns)
      setEndTime(ne)
    }
    // Only re-sync when the room/day grid or free gaps change — not while typing times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, roomId, freeGapsLayoutKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const bookingInterval = useMemo(
    () => ({
      start: parseInstantOnDate(date, startTime),
      end: parseInstantOnDate(date, endTime),
    }),
    [date, startTime, endTime],
  )

  const durationMin = Math.max(
    0,
    Math.round(
      (bookingInterval.end.getTime() - bookingInterval.start.getTime()) /
        60_000,
    ),
  )

  const { leftPct, widthPct } = intervalToPercent(
    bookingInterval,
    displayStart,
    displayEnd,
  )
  const previewWidthPct = widthPct > 0 ? Math.max(widthPct, 1.2) : 0

  function applyDurationFromStart(minutes: number) {
    const m = clamp(minutes, MIN_DURATION_MIN, MAX_DURATION_MIN)
    const startMs = parseInstantOnDate(date, startTime).getTime()
    applyIntervalClamped(startMs, startMs + m * 60_000)
  }

  function trackMetrics() {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const spanMs = displayEnd.getTime() - displayStart.getTime()
    if (spanMs <= 0) return null
    return { el, rect, spanMs }
  }

  function clientXToMs(clientX: number) {
    const m = trackMetrics()
    if (!m) return displayStart.getTime()
    const ratio = clamp((clientX - m.rect.left) / m.rect.width, 0, 1)
    return displayStart.getTime() + ratio * m.spanMs
  }

  function endDragPointer() {
    const d = dragRef.current
    if (!d) return
    const el = trackRef.current
    try {
      el?.releasePointerCapture(d.pointerId)
    } catch {
      /* ignore */
    }
    dragRef.current = null
  }

  function onPointerDownBar(kind: DragKind, e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startMs = bookingInterval.start.getTime()
    const endMs = bookingInterval.end.getTime()
    dragRef.current = {
      kind,
      originX: e.clientX,
      startMs,
      endMs,
      pointerId: e.pointerId,
    }
    const el = trackRef.current
    el?.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const m = trackMetrics()
      if (!m) return

      const w0 = displayStart.getTime()
      const w1 = displayEnd.getTime()
      const durMs = d.endMs - d.startMs
      let startMsN = d.startMs
      let endMsN = d.endMs

      if (d.kind === 'move') {
        const dxRatio = (ev.clientX - d.originX) / m.rect.width
        const deltaMs = dxRatio * m.spanMs
        startMsN = snapMsToStep(d.startMs + deltaMs, DRAG_SNAP_MIN)
        endMsN = startMsN + durMs
        if (endMsN > w1) {
          const over = endMsN - w1
          startMsN -= over
          endMsN = w1
        }
        if (startMsN < w0) {
          const under = w0 - startMsN
          startMsN = w0
          endMsN += under
        }
        if (endMsN > w1) endMsN = w1
        const durMinNow = (endMsN - startMsN) / 60_000
        if (durMinNow < MIN_DURATION_MIN) {
          startMsN = d.startMs
          endMsN = d.endMs
        }
      } else if (d.kind === 'resize-start') {
        const endFixed = d.endMs
        let newStart = snapMsToStep(clientXToMs(ev.clientX), DRAG_SNAP_MIN)
        const lo = Math.max(w0, endFixed - MAX_DURATION_MIN * 60_000)
        const hi = endFixed - MIN_DURATION_MIN * 60_000
        newStart = clamp(newStart, lo, hi)
        startMsN = newStart
        endMsN = endFixed
      } else {
        const startFixed = d.startMs
        let newEnd = snapMsToStep(clientXToMs(ev.clientX), DRAG_SNAP_MIN)
        const lo = startFixed + MIN_DURATION_MIN * 60_000
        const hi = Math.min(w1, startFixed + MAX_DURATION_MIN * 60_000)
        newEnd = clamp(newEnd, lo, hi)
        startMsN = startFixed
        endMsN = newEnd
      }

      const [a, b] = clampToFreeGaps(startMsN, endMsN, freeGaps, DRAG_SNAP_MIN)
      setStartTime(formatLocalTime(new Date(a)))
      setEndTime(formatLocalTime(new Date(b)))
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      endDragPointer()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const inputClass =
    'w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2 text-sm text-te-text outline-none transition-shadow placeholder:text-te-muted/70 focus:border-te-accent focus:ring-2 focus:ring-te-accent/20'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="absolute inset-0 bg-te-text/25 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        className="relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col rounded-t-2xl border border-te-border bg-te-surface shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-sheet-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-te-border px-5 py-4">
          <div>
            <h2
              id="booking-sheet-title"
              className="font-display text-lg font-semibold tracking-tight text-te-text"
            >
              Ny bokning
            </h2>
            {roomName ? (
              <p className="mt-0.5 text-sm text-te-muted">{roomName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-te-muted hover:bg-te-accent-muted hover:text-te-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-te-accent"
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (isLocalStartInPast(date, startTime, new Date())) {
              setClientError(
                'Välj en starttid som inte redan har passerat.',
              )
              return
            }
            onSubmit({
              roomId,
              date,
              startTime,
              endTime,
              title: title.trim() || undefined,
            })
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-te-text">Titel (valfritt)</span>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Visas i blocket nedan om du fyller i"
            />
          </label>

          <section className="space-y-2" aria-label="Förhandsvisning av bokning">
            <div
              className="flex items-end justify-between gap-2"
              aria-live="polite"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-te-muted">
                Kommer att boka
              </span>
              <span className="font-mono text-xs tabular-nums text-te-text">
                {startTime}–{endTime}
                <span className="ml-2 text-te-muted">
                  ({durationMin} min)
                </span>
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-te-muted">
              Grå block = redan bokat. Dra den gröna ytan för att flytta;
              dra i de smala strecken vid sidorna (utanför blocket) för längd.{' '}
              <span className="text-te-accent">Max 4 h.</span>
            </p>
            <div ref={trackRef} className="relative h-11 overflow-visible">
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg bg-te-border/25">
                <div className="absolute inset-x-0 top-0 flex justify-between px-1 pt-1 text-[9px] font-medium uppercase tracking-wider text-te-muted/80">
                  <span>07</span>
                  <span>13</span>
                  <span>22</span>
                </div>
                {busyClipped.map((b, i) => {
                  const { leftPct: bl, widthPct: bw } = intervalToPercent(
                    { start: b.start, end: b.end },
                    displayStart,
                    displayEnd,
                  )
                  const title = b.label
                    ? `Upptagen · ${b.label}`
                    : 'Upptagen'
                  return (
                    <div
                      key={`busy-${b.start.getTime()}-${i}`}
                      title={title}
                      className="absolute bottom-1 top-4 z-[1] flex items-center justify-center overflow-hidden rounded-sm bg-te-busy-strong/85 px-0.5 shadow-inner"
                      style={{
                        left: `${bl}%`,
                        width: `${Math.max(bw, 0.5)}%`,
                      }}
                    >
                      {b.label ? (
                        <span className="truncate text-center font-display text-[0.55rem] font-semibold leading-tight text-white drop-shadow-sm sm:text-[0.6rem]">
                          {b.label}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div
                className="absolute bottom-1 top-4 z-10"
                style={{
                  left: `${leftPct}%`,
                  width: `${previewWidthPct}%`,
                }}
              >
                <button
                  type="button"
                  aria-label="Justera starttid (vänster kant)"
                  className="absolute top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-manipulation items-center justify-end bg-transparent pr-px"
                  style={{ right: '100%' }}
                  onPointerDown={(e) => onPointerDownBar('resize-start', e)}
                >
                  <span className="pointer-events-none h-[62%] w-px rounded-full bg-te-accent shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" />
                </button>
                <div
                  className="te-booking-preview-bar flex h-full min-h-0 w-full min-w-0 cursor-grab touch-manipulation select-none items-center justify-center rounded-md border border-te-accent/35 bg-te-free-hover px-1 active:cursor-grabbing"
                  onPointerDown={(e) => onPointerDownBar('move', e)}
                  aria-label={
                    title.trim()
                      ? `Bokning: ${title.trim()}`
                      : 'Bokning utan titel — dra för att flytta'
                  }
                >
                  {title.trim() ? (
                    <span className="pointer-events-none truncate text-center font-display text-[0.6rem] font-semibold leading-tight tracking-tight text-te-accent drop-shadow-sm sm:text-[0.68rem] sm:leading-tight">
                      {title.trim()}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Justera sluttid (höger kant)"
                  className="absolute top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-manipulation items-center justify-start bg-transparent pl-px"
                  style={{ left: '100%' }}
                  onPointerDown={(e) => onPointerDownBar('resize-end', e)}
                >
                  <span className="pointer-events-none h-[62%] w-px rounded-full bg-te-accent shadow-[0_0_0_1px_rgba(0,0,0,0.07)]" />
                </button>
              </div>
            </div>
          </section>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-te-text">Datum</span>
            <input
              className={inputClass}
              type="date"
              value={date}
              min={minBookDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-te-text">
              Längd (snabbval)
            </span>
            <div className="flex flex-wrap gap-2">
              {DURATION_CHIPS_MIN.map((m) => {
                const active = durationMin === m
                return (
                  <button
                    key={m}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-te-accent bg-te-accent-muted text-te-accent'
                        : 'border-te-border text-te-muted hover:border-te-accent/50'
                    }`}
                    onClick={() => applyDurationFromStart(m)}
                  >
                    {m} min
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-te-text">Starttid</span>
              <input
                className={inputClass + ' font-mono text-xs'}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onBlur={commitManualTimes}
                placeholder="09:00"
                required
                aria-label="Starttid"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-te-text">Sluttid</span>
              <input
                className={inputClass + ' font-mono text-xs'}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onBlur={commitManualTimes}
                required
                aria-label="Sluttid"
              />
            </label>
          </div>

          <div className="border-t border-te-border pt-3">
            <button
              type="button"
              className="text-xs font-medium text-te-accent hover:underline"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              {showAdvanced ? 'Dölj' : 'Avancerat'} · rums-id
            </button>
            {showAdvanced ? (
              <label className="mt-2 grid gap-1 text-sm">
                <span className="text-te-muted">Rums-id (API)</span>
                <input
                  className={inputClass + ' font-mono text-xs'}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                />
              </label>
            ) : null}
          </div>

          {clientError ? (
            <p className="text-sm text-te-danger" role="alert">
              {clientError}
            </p>
          ) : null}
          {error ? (
            <p
              className="text-sm text-te-danger"
              role="alert"
              aria-live="polite"
            >
              {errorMessage(error)}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-te-border pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Bokar…' : 'Skapa bokning'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BookingSheet({
  open,
  onClose,
  initial,
  scheduleRooms,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean
  onClose: () => void
  initial: BookingSheetInitial | null
  scheduleRooms: RoomWithBookings[] | undefined
  onSubmit: (body: CreateBookingRequest) => void
  isPending: boolean
  error: unknown | null
}) {
  if (!open || !initial) return null

  return (
    <BookingSheetForm
      key={`${initial.roomId}-${initial.date}-${initial.startTime}-${initial.endTime}`}
      initial={initial}
      scheduleRooms={scheduleRooms}
      onClose={onClose}
      onSubmit={onSubmit}
      isPending={isPending}
      error={error}
    />
  )
}
