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
}: {
  roomsQuery: UseQueryResult<Array<Room>, unknown>
  onBookRoom: (room: Room) => void
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

  const th = 'pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-te-muted'

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

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Sök namn</span>
          <input
            className="rounded-lg border border-te-border bg-te-elevated px-3 py-2 text-sm outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="t.ex. Kuggen"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Campus</span>
          <select
            className="rounded-lg border border-te-border bg-te-elevated px-3 py-2 text-sm outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20"
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-te-muted">Sortera</span>
          <select
            className="rounded-lg border border-te-border bg-te-elevated px-3 py-2 text-sm outline-none focus:border-te-accent focus:ring-2 focus:ring-te-accent/20"
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
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-te-border bg-te-elevated shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-te-border">
                <th className={th}>Namn</th>
                <th className={th}>Betyg</th>
                <th className={th}>Campus</th>
                <th className={th}>Platser</th>
                <th className={th}>Id</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-te-border/80">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-te-muted"
                  >
                    Inga rum matchar.
                  </td>
                </tr>
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
                  <tr key={room.id} className="hover:bg-te-accent-muted/30">
                    <td className="px-4 py-3 font-medium text-te-text">
                      {room.name}
                    </td>
                    <td className="px-4 py-3 text-te-muted">
                      {rr != null ? (
                        <span
                          className="cursor-help border-b border-dotted border-te-muted/80 text-te-text"
                          title={rr.comment}
                        >
                          {betyg}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-te-muted">{room.campus}</td>
                    <td className="px-4 py-3 text-te-muted">
                      {room.capacity ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-te-muted">
                      {room.id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        className="text-xs"
                        onClick={() => onBookRoom(room)}
                      >
                        Boka
                      </Button>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
