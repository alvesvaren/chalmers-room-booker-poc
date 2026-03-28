import { useMemo, useState } from 'react'
import type { Room } from '../client/types.gen'
import type { UseQueryResult } from '@tanstack/react-query'
import { errorMessage } from '../lib/errors'
import { getRoomRating, ratingSortValue } from '../lib/roomRatings'
import { Button } from './ui/Button'
import { Skeleton } from './ui/Skeleton'

type SortKey = 'rating' | 'name' | 'campus' | 'capacity'

export function RoomsTab({
  roomsQuery,
  onBookRoom,
  isRoomBookable,
}: {
  roomsQuery: UseQueryResult<Array<Room>, unknown>
  onBookRoom: (room: Room) => void
  isRoomBookable: (room: Room) => boolean
}) {
  const [search, setSearch] = useState('')
  const [campusPick, setCampusPick] = useState('')
  const [sort, setSort] = useState<SortKey>('rating')

  const campuses = useMemo(() => {
    const s = new Set<string>()
    for (const r of roomsQuery.data ?? []) {
      if (r.campus) s.add(r.campus)
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'sv'))
  }, [roomsQuery.data])

  const filtered = useMemo(() => {
    let list = [...(roomsQuery.data ?? [])]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => r.name.toLowerCase().includes(q))
    }
    if (campusPick) {
      list = list.filter((r) =>
        r.campus.toLowerCase().includes(campusPick.toLowerCase()),
      )
    }
    list.sort((a, b) => {
      if (sort === 'rating') {
        const cmp = ratingSortValue(b.name) - ratingSortValue(a.name)
        if (cmp !== 0) return cmp
        return a.name.localeCompare(b.name, 'sv')
      }
      if (sort === 'name') {
        return a.name.localeCompare(b.name, 'sv')
      }
      if (sort === 'campus') {
        const c = a.campus.localeCompare(b.campus, 'sv')
        if (c !== 0) return c
        return a.name.localeCompare(b.name, 'sv')
      }
      const ca = a.capacity ?? -1
      const cb = b.capacity ?? -1
      if (ca !== cb) return ca - cb
      return a.name.localeCompare(b.name, 'sv')
    })
    return list
  }, [roomsQuery.data, search, campusPick, sort])

  const filterGrid =
    'grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
  const fieldClass =
    'min-w-0 w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2.5 text-sm outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:py-2'
  const roomGridClass =
    'grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]'

  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-te-text">
          Rum
        </h2>
        <p className="mt-1 text-sm text-te-muted">
          Filtrera och öppna bokning med förifylld tid.
        </p>
      </div>

      <div className={filterGrid}>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Sök namn</span>
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="t.ex. Kuggen"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Campus</span>
          <select
            className={fieldClass}
            value={campusPick}
            onChange={(e) => setCampusPick(e.target.value)}
          >
            <option value="">Alla</option>
            {campuses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm sm:col-span-2 lg:col-span-1">
          <span className="font-medium text-te-muted">Sortera</span>
          <select
            className={fieldClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="rating">Betyg (CSV)</option>
            <option value="name">Namn</option>
            <option value="campus">Campus</option>
            <option value="capacity">Platser</option>
          </select>
        </label>
      </div>

      {roomsQuery.isError ? (
        <p className="text-sm text-te-danger">{errorMessage(roomsQuery.error)}</p>
      ) : null}

      {roomsQuery.isLoading ? (
        <div className={roomGridClass}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-46 w-full rounded-xl border border-te-border"
            />
          ))}
        </div>
      ) : (
        <div className={roomGridClass}>
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-te-border bg-te-elevated/50 px-4 py-12 text-center text-sm text-te-muted">
              Inga rum matchar.
            </div>
          ) : (
            filtered.map((room) => {
              const rr = getRoomRating(room.name)
              const betyg =
                rr != null
                  ? rr.overall.toLocaleString('sv-SE', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })
                  : null
              return (
                <article
                  key={room.id}
                  className="group flex h-full min-h-60 min-w-0 flex-col rounded-xl border border-te-border bg-te-elevated p-4 shadow-sm transition-[box-shadow] duration-200 hover:border-te-accent/25 hover:shadow-md sm:p-5"
                >
                  <div className="min-h-0 min-w-0 flex-1 space-y-4">
                    <header className="min-w-0">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-te-muted">
                        Grupprum
                      </p>
                      <h3 className="mt-1.5 font-display text-xl font-semibold leading-[1.15] tracking-tight text-te-text sm:text-2xl">
                        {room.name}
                      </h3>
                    </header>

                    {rr != null ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <span
                          className="font-display text-3xl font-semibold leading-none tabular-nums text-te-accent sm:text-[2.35rem]"
                          title={rr.comment}
                        >
                          {betyg}
                        </span>
                        <span className="cursor-help border-b border-dotted border-te-muted/70 pb-0.5 text-xs font-medium text-te-muted">
                          genomsnitt (CSV)
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-te-muted">
                        Ingen betygsdata
                      </p>
                    )}

                    <p
                      className="text-sm leading-snug text-te-muted"
                      title={`${room.campus} · ${room.capacity ?? '—'} platser`}
                    >
                      <span className="font-medium text-te-text/95">
                        {room.campus}
                      </span>
                      <span
                        aria-hidden
                        className="mx-2 inline-block h-3 w-px translate-y-px bg-te-border align-middle"
                      />
                      <span className="tabular-nums">
                        {room.capacity ?? '—'} platser
                      </span>
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    className="mt-5 w-full touch-manipulation py-2.5 text-sm"
                    disabled={!isRoomBookable(room)}
                    title={
                      !isRoomBookable(room)
                        ? 'Ingen ledig tid kvar denna vecka från och med nu'
                        : undefined
                    }
                    onClick={() => onBookRoom(room)}
                  >
                    Boka detta rum
                  </Button>
                </article>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
