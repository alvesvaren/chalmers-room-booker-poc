import type { Booking } from "../client/types.gen";
import { errorMessage } from "../lib/errors";
import { Button } from "./ui/Button";

export function MyBookingsTab({
  myBookings,
  cancelMutation,
  onCancelRequest,
  cancelError,
}: {
  myBookings: Booking[];
  cancelMutation: { isPending: boolean };
  onCancelRequest: (id: string) => void;
  cancelError: unknown | null;
}) {
  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <h2 className="font-display text-te-text text-xl font-semibold">
        Mina bokningar
      </h2>

      <ul className="divide-te-mine-border border-te-mine-border bg-te-mine-bg divide-y rounded-xl border shadow-sm">
        {myBookings.length === 0 ? (
          <li className="text-te-muted px-4 py-10 text-center text-sm">
            Inga bokningar ännu.
          </li>
        ) : (
          myBookings.map((b) => (
            <li
              key={b.id}
              className="bg-te-mine-bg hover:bg-te-mine-row flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors"
            >
              <div>
                <p
                  className="text-te-text font-medium"
                  title={b.room.id ? `id ${b.room.id}` : undefined}
                >
                  {b.room.name}
                </p>
                <p className="text-te-muted text-sm">
                  {b.start} → {b.end}
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

      {cancelError ? (
        <p className="text-te-danger text-sm">{errorMessage(cancelError)}</p>
      ) : null}
    </div>
  );
}
