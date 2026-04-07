import { useTranslation } from "react-i18next";
import { Skeleton } from "../ui/Skeleton";

/** Placeholder grid matching `RoomWeekCard` layout while bookings are loading. */
function ScheduleWeekCardSkeleton({ dayPattern }: { dayPattern: number }) {
  const barMasks: [number, number][] =
    dayPattern % 3 === 0
      ? [
          [6, 20],
          [38, 24],
          [72, 18],
        ]
      : dayPattern % 3 === 1
        ? [
            [10, 28],
            [52, 15],
          ]
        : [
            [4, 12],
            [28, 40],
            [85, 10],
          ];

  return (
    <article
      className="border-te-border bg-te-elevated flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm"
      aria-hidden
    >
      <div className="border-te-border/80 flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-7 w-3/5 max-w-xs rounded-md" />
          <Skeleton className="h-3.5 w-full max-w-sm rounded" />
        </div>
        <Skeleton className="h-10 w-full shrink-0 rounded-lg sm:w-28" />
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="ml-12 hidden justify-between sm:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-6 rounded-full opacity-60" />
          ))}
        </div>

        {Array.from({ length: 7 }).map((_, dayIdx) => {
          const segments =
            (dayPattern + dayIdx) % 3 === 1 ? barMasks.slice(0, 2) : barMasks;
          return (
            <div
              key={dayIdx}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr] sm:items-center"
            >
              <Skeleton className="h-4 w-24 rounded sm:w-14" />
              <div className="bg-te-border/20 relative h-9 overflow-hidden rounded-lg">
                {segments.map(([left, width], j) => (
                  <Skeleton
                    key={j}
                    className="absolute inset-y-1 rounded-sm opacity-75"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <Skeleton className="mx-auto h-3 w-full max-w-xl rounded opacity-50" />
      </div>
    </article>
  );
}

const scheduleGridClass =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]";

export function WorkspaceSuspenseFallback() {
  const { t } = useTranslation();
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="sr-only">{t("workspace.loading")}</p>
      <div className={scheduleGridClass}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ScheduleWeekCardSkeleton key={i} dayPattern={i} />
        ))}
      </div>
    </div>
  );
}
