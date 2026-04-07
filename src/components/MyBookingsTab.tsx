import { useTranslation } from "react-i18next";
import { errorMessage } from "../lib/errors";
import {
  formatLocalDate,
  formatLocalTime,
  parseApiInterval,
} from "../lib/weekTimeline";
import type { MyBookingsTabProps } from "./workspaceTabProps";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

export function MyBookingsTab({ data, status, actions }: MyBookingsTabProps) {
  const { rooms, myBookings } = data;
  const { loadPending, uiStale, cancelError } = status;
  const { cancelMutation, onCancelRequest } = actions;
  const { t } = useTranslation();
  const list = myBookings ?? [];
  const roomNameById = new Map((rooms ?? []).map((r) => [r.id, r.name]));

  return (
    <div className="te-reveal te-reveal-delay-1 space-y-6">
      <h2 className="font-display text-te-text text-xl font-semibold">
        {t("mine.heading")}
      </h2>

      <ul
        className={`divide-te-mine-border border-te-mine-border bg-te-mine-bg divide-y rounded-xl border shadow-sm ${
          uiStale ? "opacity-60 saturate-[0.85] transition-[opacity,filter] duration-150" : ""
        }`}
      >
        {loadPending
          ? Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="bg-te-mine-bg flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full rounded" />
                  <Skeleton className="h-3 w-64 max-w-full rounded" />
                </div>
                <Skeleton className="h-9 w-20 shrink-0 rounded-md" />
              </li>
            ))
          : null}
        {!loadPending && myBookings !== undefined && list.length === 0 ? (
          <li className="text-te-muted px-4 py-10 text-center text-sm">
            {t("mine.empty")}
          </li>
        ) : null}
        {!loadPending && list.length > 0
          ? list.map((b) => {
              const { start, end } = parseApiInterval(b.interval);
              const roomTitle =
                roomNameById.get(b.roomId) ??
                t("mine.roomIdFallback", { id: b.roomId });
              return (
            <li
              key={b.id}
              className="bg-te-mine-bg hover:bg-te-mine-row flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors"
            >
              <div>
                <p
                  className="text-te-text font-medium"
                  title={`id ${b.roomId}`}
                >
                  {roomTitle}
                </p>
                <p className="text-te-muted text-sm">
                  {formatLocalDate(start)}{" "}
                  {formatLocalTime(start)}–{formatLocalTime(end)}
                </p>
              </div>
              <Button
                variant="danger"
                className="text-xs"
                disabled={cancelMutation.isPending}
                onClick={() => onCancelRequest(b.id)}
              >
                {t("mine.cancel")}
              </Button>
            </li>
              );
            })
          : null}
      </ul>

      {cancelError ? (
        <p className="text-te-danger text-sm">{errorMessage(cancelError)}</p>
      ) : null}
    </div>
  );
}
