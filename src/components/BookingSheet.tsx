import { useEffect, useState } from 'react'
import type { CreateBookingRequest } from '../client/types.gen'
import { errorMessage } from '../lib/errors'
import { Button } from './ui/Button'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return 9 * 60
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const DURATIONS_MIN = [30, 60, 120] as const
const PRESET_STARTS = ['08:00', '09:00', '10:15', '12:00', '13:15']

export type BookingSheetInitial = {
  roomId: string
  roomName?: string
  date: string
  startTime: string
  endTime: string
}

function BookingSheetForm({
  initial,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  initial: BookingSheetInitial
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
  const [title, setTitle] = useState('Demo booking')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function applyDuration(minutes: number) {
    const startM = timeToMinutes(startTime)
    const endM = startM + minutes
    setEndTime(minutesToTime(endM))
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
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-te-border bg-te-surface shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
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
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
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
            <span className="font-medium text-te-text">Datum</span>
            <input
              className={inputClass}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-te-text">Starttid</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_STARTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    startTime === t
                      ? 'border-te-accent bg-te-accent-muted text-te-accent'
                      : 'border-te-border text-te-muted hover:border-te-accent/50'
                  }`}
                  onClick={() => {
                    setStartTime(t)
                    const sm = timeToMinutes(t)
                    setEndTime(minutesToTime(sm + 60))
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              className={inputClass + ' font-mono text-xs'}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="09:00"
              required
              aria-label="Starttid"
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-te-text">Längd</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS_MIN.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant="secondary"
                  className="rounded-full px-3 py-1.5 text-xs"
                  onClick={() => applyDuration(m)}
                >
                  {m} min
                </Button>
              ))}
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-te-muted">Sluttid</span>
              <input
                className={inputClass + ' font-mono text-xs'}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-te-text">Titel (valfritt)</span>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

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
  onSubmit,
  isPending,
  error,
}: {
  open: boolean
  onClose: () => void
  initial: BookingSheetInitial | null
  onSubmit: (body: CreateBookingRequest) => void
  isPending: boolean
  error: unknown | null
}) {
  if (!open || !initial) return null

  return (
    <BookingSheetForm
      key={`${initial.roomId}-${initial.date}-${initial.startTime}-${initial.endTime}`}
      initial={initial}
      onClose={onClose}
      onSubmit={onSubmit}
      isPending={isPending}
      error={error}
    />
  )
}
