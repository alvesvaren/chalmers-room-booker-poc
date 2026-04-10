import { addLocalCalendarDays } from "../lib/datetime";

const STEP_BTN_CLASS =
  "border-te-border bg-te-elevated text-te-text hover:bg-te-surface focus-visible:outline-te-accent inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-lg font-semibold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10 sm:text-base";

type DayDateStepperProps = {
  value: string;
  minDate: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  minusLabel: string;
  plusLabel: string;
  inputClassName: string;
};

export function DayDateStepper({
  value,
  minDate,
  onChange,
  disabled = false,
  minusLabel,
  plusLabel,
  inputClassName,
}: DayDateStepperProps) {
  const prev = addLocalCalendarDays(value, -1);
  const next = addLocalCalendarDays(value, 1);
  const canDecrement = !disabled && prev >= minDate;

  return (
    <div className="flex min-w-0 max-w-full items-stretch gap-1.5 sm:gap-2">
      <button
        type="button"
        className={STEP_BTN_CLASS}
        aria-label={minusLabel}
        disabled={!canDecrement}
        onClick={() => {
          if (canDecrement) onChange(prev);
        }}
      >
        -
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="date"
          className={inputClassName}
          min={minDate}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        className={STEP_BTN_CLASS}
        aria-label={plusLabel}
        disabled={disabled}
        onClick={() => onChange(next)}
      >
        +
      </button>
    </div>
  );
}
