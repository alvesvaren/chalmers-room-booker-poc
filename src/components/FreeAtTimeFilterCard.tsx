import { useTranslation } from "react-i18next";
import {
  clampIntervalToDayWindow,
  dayDisplayBounds,
  DURATION_CHIPS_MIN,
} from "../lib/bookingSheetMath";
import {
  addMinutes,
  formatLocalTime,
  parseInstantOnDate,
} from "../lib/weekTimeline";
import { DayIntervalTimeline } from "./DayIntervalTimeline";
import { Checkbox } from "./ui/Checkbox";
import { Skeleton } from "./ui/Skeleton";

const FIELD_CLASS =
  "box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-te-border bg-te-elevated px-3 text-base text-te-text outline-none transition-[box-shadow,background-color] focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:h-10 sm:text-sm";

const PANEL_CLASS =
  "rounded-2xl border border-te-accent/20 bg-gradient-to-br from-te-accent/[0.07] via-te-elevated to-te-surface p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5";

export type FreeAtTimeFilterCardProps = {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  minBookDate: string;
  slotDate: string;
  onSlotDateChange: (date: string) => void;
  slotStartTime: string;
  slotEndTime: string;
  onSlotIntervalChange: (next: { startTime: string; endTime: string }) => void;
  crossesDayUi: boolean;
  bookingsWeekLabel: string;
  showBookingsWeekFetching: boolean;
};

export function FreeAtTimeFilterCard({
  active,
  onActiveChange,
  minBookDate,
  slotDate,
  onSlotDateChange,
  slotStartTime,
  slotEndTime,
  onSlotIntervalChange,
  crossesDayUi,
  bookingsWeekLabel,
  showBookingsWeekFetching,
}: FreeAtTimeFilterCardProps) {
  const { t } = useTranslation();

  return (
    <div className={PANEL_CLASS}>
      <label className="flex cursor-pointer items-baseline gap-3 select-none">
        <Checkbox
          checked={active}
          onCheckedChange={(c) => onActiveChange(c === true)}
        />
        <span className="font-display text-te-text text-sm font-semibold">
          {t("rooms.freeAtTime")}
        </span>
      </label>

      <fieldset
        disabled={!active}
        className="group border-te-border/60 mt-4 min-w-0 space-y-4 border-0 border-t p-0 pt-4"
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-te-muted font-medium">{t("rooms.day")}</span>
          <input
            type="date"
            className={`${FIELD_CLASS} group-disabled:cursor-not-allowed group-disabled:opacity-60`}
            min={minBookDate}
            value={slotDate}
            onChange={(e) => onSlotDateChange(e.target.value)}
          />
        </label>
        <DayIntervalTimeline
          dateStr={slotDate}
          startTime={slotStartTime}
          endTime={slotEndTime}
          onIntervalChange={onSlotIntervalChange}
          busySegments={[]}
          roomIdForMineCheck=""
          sectionAriaLabel={t("rooms.slotFilterPreviewAria")}
          summaryLeftLabel=""
          showBusyOverlay={false}
          showTrackLabels={false}
          barGrabAriaLabel={t("rooms.slotFilterGrabAria")}
          disabled={!active}
        />
        <div>
          <span className="text-te-muted mb-2 block text-xs font-medium">
            {t("rooms.durationPresets")}
          </span>
          <div className="flex flex-wrap gap-2">
            {DURATION_CHIPS_MIN.map((m) => {
              const dur =
                (parseInstantOnDate(slotDate, slotEndTime).getTime() -
                  parseInstantOnDate(slotDate, slotStartTime).getTime()) /
                60_000;
              const chipActive = Math.round(dur) === m;
              return (
                <button
                  key={m}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none ${
                    chipActive
                      ? "border-te-accent bg-te-accent-muted text-te-accent group-disabled:border-te-border group-disabled:bg-te-elevated group-disabled:text-te-muted"
                      : "border-te-border text-te-muted enabled:hover:border-te-accent/40"
                  }`}
                  onClick={() => {
                    const { start: w0, end: w1 } = dayDisplayBounds(slotDate);
                    const sMs = parseInstantOnDate(
                      slotDate,
                      slotStartTime,
                    ).getTime();
                    const eMs = addMinutes(new Date(sMs), m).getTime();
                    const [a, b] = clampIntervalToDayWindow(
                      sMs,
                      eMs,
                      slotDate,
                      w0,
                      w1,
                    );
                    onSlotIntervalChange({
                      startTime: formatLocalTime(new Date(a)),
                      endTime: formatLocalTime(new Date(b)),
                    });
                  }}
                >
                  {m} min
                </button>
              );
            })}
          </div>
        </div>
        {crossesDayUi && (
          <p className="text-te-danger text-xs font-medium">
            {t("rooms.crossesMidnight")}
          </p>
        )}
      </fieldset>

      {showBookingsWeekFetching && (
        <div
          className="border-te-border/60 mt-4 space-y-3 border-t pt-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="sr-only">
            {t("rooms.fetchingBookingsWeek", { week: bookingsWeekLabel })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-2.5 w-full max-w-40 rounded-full sm:max-w-56" />
            <Skeleton className="hidden h-2.5 w-16 rounded-full sm:block" />
          </div>
        </div>
      )}
    </div>
  );
}
