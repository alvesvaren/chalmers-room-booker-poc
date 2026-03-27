import type { RoomCalendarSlot, RoomWithBookings } from '../client/types.gen'

/** Monday 00:00 local of the week containing `anchor`, plus `weekOffset` full weeks. `weekEnd` is exclusive (next Monday 00:00). */
export function getWeekRange(weekOffset: number, anchor: Date = new Date()) {
  const d = new Date(anchor)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  const toMonday = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + toMonday + weekOffset * 7)
  const weekStart = new Date(d)
  const weekEnd = new Date(d)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return { weekStart, weekEnd }
}

/** API returns naive local wall-clock strings (no timezone suffix). */
export function parseNaiveLocal(isoLike: string): Date {
  const normalized = isoLike.trim().replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${isoLike}`)
  }
  return d
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatLocalTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

export function formatWeekRangeLabel(weekStart: Date, weekEndExclusive: Date) {
  const lastDay = new Date(weekEndExclusive)
  lastDay.setDate(lastDay.getDate() - 1)
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
  })
  return `${fmt.format(weekStart)}–${fmt.format(lastDay)}`
}

export type TimeInterval = { start: Date; end: Date }

export type BusySegment = TimeInterval & { label?: string }

const MIN_GAP_MS = 60_000

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )
  const out: TimeInterval[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) {
        last.end = cur.end
      }
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

function subtractBusyFromWindow(
  windowStart: Date,
  windowEnd: Date,
  busy: TimeInterval[],
): TimeInterval[] {
  const clipped = busy
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .map((b) => ({
      start: new Date(
        Math.max(b.start.getTime(), windowStart.getTime()),
      ) as Date,
      end: new Date(Math.min(b.end.getTime(), windowEnd.getTime())) as Date,
    }))
  const merged = mergeIntervals(clipped)
  const gaps: TimeInterval[] = []
  let cursor = windowStart.getTime()
  for (const b of merged) {
    if (b.start.getTime() > cursor) {
      gaps.push({ start: new Date(cursor), end: new Date(b.start.getTime()) })
    }
    cursor = Math.max(cursor, b.end.getTime())
  }
  if (cursor < windowEnd.getTime()) {
    gaps.push({ start: new Date(cursor), end: new Date(windowEnd.getTime()) })
  }
  return gaps.filter((g) => g.end.getTime() - g.start.getTime() >= MIN_GAP_MS)
}

function startOfDayWithHour(d: Date, hour: number) {
  const x = new Date(d)
  x.setHours(hour, 0, 0, 0)
  return x
}

export type DayTimeline = {
  date: Date
  dateStr: string
  weekdayShort: string
  displayStart: Date
  displayEnd: Date
  busy: BusySegment[]
  free: TimeInterval[]
}

export const DEFAULT_DAY_START_H = 7
export const DEFAULT_DAY_END_H = 22

function slotToBusy(s: RoomCalendarSlot): BusySegment {
  return {
    start: parseNaiveLocal(s.start),
    end: parseNaiveLocal(s.end),
    label: s.label,
  }
}

/** Build per-day busy + free gaps for timeline rendering (clips to visible hours). */
export function buildRoomWeekTimeline(
  room: RoomWithBookings,
  weekStart: Date,
  weekEndExclusive: Date,
  dayStartH: number = DEFAULT_DAY_START_H,
  dayEndH: number = DEFAULT_DAY_END_H,
): DayTimeline[] {
  const busyAll: BusySegment[] = room.bookings.map(slotToBusy)

  const days: DayTimeline[] = []
  for (
    let cursor = new Date(weekStart);
    cursor < weekEndExclusive;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const dayDate = new Date(cursor)
    const displayStart = startOfDayWithHour(dayDate, dayStartH)
    const displayEnd = startOfDayWithHour(dayDate, dayEndH)

    const dayEndMidnight = startOfDayWithHour(dayDate, 24)
    const dayStartMidnight = startOfDayWithHour(dayDate, 0)

    const busy = busyAll
      .filter(
        (b) => b.end > dayStartMidnight && b.start < dayEndMidnight,
      )
      .map((b) => ({
        start: new Date(
          Math.max(b.start.getTime(), dayStartMidnight.getTime()),
        ),
        end: new Date(Math.min(b.end.getTime(), dayEndMidnight.getTime())),
        label: b.label,
      }))
      .filter((b) => b.end > b.start)

    const busyForGaps = busy.map((b) => ({ start: b.start, end: b.end }))
    const mergedBusy = mergeIntervals(busyForGaps)
    const free = subtractBusyFromWindow(displayStart, displayEnd, mergedBusy)

    const weekdayShort = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'short',
    }).format(dayDate)

    days.push({
      date: dayDate,
      dateStr: formatLocalDate(dayDate),
      weekdayShort,
      displayStart,
      displayEnd,
      busy,
      free,
    })
  }
  return days
}

/** Position as % of [windowStart, windowEnd]: { left, width } for CSS. */
export function intervalToPercent(
  interval: TimeInterval,
  windowStart: Date,
  windowEnd: Date,
) {
  const w0 = windowStart.getTime()
  const w1 = windowEnd.getTime()
  const span = w1 - w0
  if (span <= 0) return { leftPct: 0, widthPct: 0 }
  const t0 = Math.max(interval.start.getTime(), w0)
  const t1 = Math.min(interval.end.getTime(), w1)
  const leftPct = ((t0 - w0) / span) * 100
  const widthPct = Math.max(0, ((t1 - t0) / span) * 100)
  return { leftPct, widthPct }
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

/** Default booking length when opening the sheet (1 h, capped by gap end). */
export function defaultBookingWindow(gap: TimeInterval): TimeInterval {
  const oneHour = addMinutes(gap.start, 60)
  const endMs = Math.min(gap.end.getTime(), oneHour.getTime())
  return { start: gap.start, end: new Date(endMs) }
}

export function toBookingDraft(
  roomId: string,
  roomName: string | undefined,
  gap: TimeInterval,
): {
  roomId: string
  roomName?: string
  date: string
  startTime: string
  endTime: string
} {
  const w = defaultBookingWindow(gap)
  return {
    roomId,
    roomName,
    date: formatLocalDate(w.start),
    startTime: formatLocalTime(w.start),
    endTime: formatLocalTime(w.end),
  }
}

/** First free gap in the visible week for default booking prefill from Rooms tab. */
export function firstFreeGapInWeek(
  room: RoomWithBookings,
  weekStart: Date,
  weekEndExclusive: Date,
): TimeInterval | null {
  const days = buildRoomWeekTimeline(
    room,
    weekStart,
    weekEndExclusive,
    DEFAULT_DAY_START_H,
    DEFAULT_DAY_END_H,
  )
  for (const d of days) {
    if (d.free.length > 0) {
      return d.free[0]
    }
  }
  const fallback = new Date(weekStart)
  fallback.setHours(DEFAULT_DAY_START_H + 1, 0, 0, 0)
  const end = new Date(fallback)
  end.setHours(fallback.getHours() + 1)
  return { start: fallback, end }
}
