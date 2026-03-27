import type { Booking } from '../client/types.gen'
import type { UseQueryResult } from '@tanstack/react-query'
import { errorMessage } from '../lib/errors'
import { Button } from './ui/Button'
import { Skeleton } from './ui/Skeleton'

export function MyBookingsTab({
  myBookingsQuery,
  cancelMutation,
  onCancelRequest,
  cancelError,
}: {
  myBookingsQuery: UseQueryResult<Array<Booking>, unknown>
  cancelMutation: { isPending: boolean }
  onCancelRequest: (id: string) => void
  cancelError: unknown | null
}) {
  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-te-text">
          Mina bokningar
        </h2>
        <p className="mt-1 text-sm text-te-muted">
          Avboka eller skapa nya bokningar via flikarna Schema och Rum.
        </p>
      </div>

      {myBookingsQuery.isError ? (
        <p className="text-sm text-te-danger">
          {errorMessage(myBookingsQuery.error)}
        </p>
      ) : null}

      {myBookingsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-te-border rounded-xl border border-te-border bg-te-elevated shadow-sm">
          {(myBookingsQuery.data ?? []).length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-te-muted">
              Inga bokningar ännu.
            </li>
          ) : (
            (myBookingsQuery.data ?? []).map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div>
                  <p className="font-medium text-te-text">
                    {b.room.name}
                    {b.room.id ? (
                      <span className="ml-2 font-mono text-xs text-te-muted">
                        {b.room.id}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-te-muted">
                    {b.start} → {b.end} · ref {b.id}
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="text-xs"
                  disabled={cancelMutation.isPending}
                  onClick={() => onCancelRequest(b.id)}
                >
                  Avboka
                </Button>
              </li>
            ))
          )}
        </ul>
      )}

      {cancelError ? (
        <p className="text-sm text-te-danger">{errorMessage(cancelError)}</p>
      ) : null}
    </div>
  )
}
