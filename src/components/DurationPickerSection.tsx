import { useTranslation } from "react-i18next";
import {
  clampNum,
  DURATION_CHIPS_MIN,
  MAX_BOOK_DURATION_MIN,
  MIN_BOOK_DURATION_MIN,
} from "../lib/bookingSheetMath";

const SLIDER_STEP_MIN = 15;

const rangeThumbClass =
  "pointer-events-none absolute h-2.5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-te-accent [&::-webkit-slider-thumb]:bg-te-elevated [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-moz-range-track]:h-2.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-te-accent [&::-moz-range-thumb]:bg-te-elevated [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:[&::-moz-range-thumb]:cursor-grabbing";

type DurationPickerSectionProps = {
  valueMinutes: number;
  onChangeMinutes: (minutes: number) => void;
  disabled?: boolean;
  /** Override heading above the value (default: booking.durationMinutesLabel) */
  durationSummaryLabel?: string;
  /** Override presets section title (default: booking.durationPresets) */
  presetsHeading?: string;
  /** Override range input aria-label (default: booking.durationSliderAria) */
  sliderAriaLabel?: string;
};

function roundToStep(minutes: number, step: number) {
  return Math.round(minutes / step) * step;
}

/**
 * Shared duration UI: native range slider (15–240 min) + preset chips.
 * Used by the booking modal and the “free at time” filter on Rooms.
 */
export function DurationPickerSection({
  valueMinutes,
  onChangeMinutes,
  disabled,
  durationSummaryLabel,
  presetsHeading,
  sliderAriaLabel,
}: DurationPickerSectionProps) {
  const { t } = useTranslation();
  const summaryLabel =
    durationSummaryLabel ?? t("booking.durationMinutesLabel");
  const presetsTitle = presetsHeading ?? t("booking.durationPresets");
  const rangeAria = sliderAriaLabel ?? t("booking.durationSliderAria");
  const sliderValue = clampNum(
    roundToStep(valueMinutes, SLIDER_STEP_MIN),
    MIN_BOOK_DURATION_MIN,
    MAX_BOOK_DURATION_MIN,
  );
  const fillPct =
    ((sliderValue - MIN_BOOK_DURATION_MIN) /
      (MAX_BOOK_DURATION_MIN - MIN_BOOK_DURATION_MIN)) *
    100;

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : "space-y-3"}>
      <div
        className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2"
        aria-live="polite"
      >
        <span className="text-te-muted shrink-0 text-xs font-semibold tracking-[0.12em] uppercase">
          {summaryLabel}
        </span>
        <span className="text-te-text break-anywhere min-w-0 font-mono text-xs tabular-nums sm:text-right">
          {t("booking.minutesSuffix", { count: sliderValue })}
        </span>
      </div>

      <div className="relative h-12" role="group">
        <div
          className="bg-te-border/70 pointer-events-none absolute top-1/2 right-0 left-0 h-2.5 -translate-y-1/2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
          aria-hidden
        />
        <div
          className="from-te-accent/25 via-te-accent/45 to-te-accent/25 pointer-events-none absolute top-1/2 h-2.5 -translate-y-1/2 rounded-l-full bg-linear-to-r shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          style={{
            left: 0,
            width: `${fillPct}%`,
          }}
          aria-hidden
        />
        <input
          type="range"
          className={`${rangeThumbClass} absolute top-1/2 z-20 w-full -translate-y-1/2`}
          min={MIN_BOOK_DURATION_MIN}
          max={MAX_BOOK_DURATION_MIN}
          step={SLIDER_STEP_MIN}
          value={sliderValue}
          disabled={disabled}
          aria-label={rangeAria}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            onChangeMinutes(
              clampNum(v, MIN_BOOK_DURATION_MIN, MAX_BOOK_DURATION_MIN),
            );
          }}
        />
      </div>
      <div
        className="text-te-muted/90 flex justify-between font-mono text-[0.65rem] font-medium tracking-wider uppercase"
        aria-hidden
      >
        <span>{MIN_BOOK_DURATION_MIN}</span>
        <span>{MAX_BOOK_DURATION_MIN}</span>
      </div>

      <div className="grid gap-2 pt-1">
        <span className="text-te-text text-sm font-medium">
          {presetsTitle}
        </span>
        <div className="flex flex-wrap gap-2">
          {DURATION_CHIPS_MIN.map((m) => {
            const active = sliderValue === m;
            return (
              <button
                key={m}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-te-accent bg-te-accent-muted text-te-accent"
                    : "border-te-border text-te-muted hover:border-te-accent/50"
                }`}
                disabled={disabled}
                onClick={() => onChangeMinutes(m)}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
