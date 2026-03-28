import type { UseQueryResult } from "@tanstack/react-query";
import type { Booking } from "../client/types.gen";
import { errorMessage } from "../lib/errors";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

export function MyBookingsTab({
  myBookingsQuery,
  cancelMutation,
  onCancelRequest,
  cancelError,
}: {
  myBookingsQuery: UseQueryResult<Array<Booking>, unknown>;
  cancelMutation: { isPending: boolean };
  onCancelRequest: (id: string) => void;
  cancelError: unknown | null;
}) {
  return (
    <div className='te-reveal te-reveal-delay-1 space-y-6'>
      <h2 className='font-display text-xl font-semibold text-te-text'>Mina bokningar</h2>

      {myBookingsQuery.isError ? <p className='text-sm text-te-danger'>{errorMessage(myBookingsQuery.error)}</p> : null}

      {myBookingsQuery.isLoading ? (
        <div className='space-y-3'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
        </div>
      ) : (
        <ul className='divide-y divide-te-mine-border rounded-xl border border-te-mine-border bg-te-mine-bg shadow-sm'>
          {(myBookingsQuery.data ?? []).length === 0 ? (
            <li className='px-4 py-10 text-center text-sm text-te-muted'>Inga bokningar ännu.</li>
          ) : (
            (myBookingsQuery.data ?? []).map(b => (
              <li key={b.id} className='flex flex-wrap items-center justify-between gap-3 bg-te-mine-bg px-4 py-4 transition-colors hover:bg-te-mine-row'>
                <div>
                  <p className='font-medium text-te-text' title={b.room.id ? `id ${b.room.id}` : undefined}>
                    {b.room.name}
                  </p>
                  <p className='text-sm text-te-muted'>
                    {b.start} → {b.end}
                  </p>
                </div>
                <Button variant='danger' className='text-xs' disabled={cancelMutation.isPending} onClick={() => onCancelRequest(b.id)}>
                  Avboka
                </Button>
              </li>
            ))
          )}
        </ul>
      )}

      {cancelError ? <p className='text-sm text-te-danger'>{errorMessage(cancelError)}</p> : null}
    </div>
  );
}
