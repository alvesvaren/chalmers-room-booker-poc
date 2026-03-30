import { useCallback, useId, useState } from "react";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

type Props = {
  minBound: number;
  maxBound: number;
  valueMin: number;
  valueMax: number;
  onChange: (next: { min: number; max: number }) => void;
  disabled?: boolean;
  label?: string;
};

/**
 * Dual-thumb range for seat counts. Two stacked range inputs with accent thumbs and a filled track between values.
 */
export function CapacityRangeSlider({
  minBound,
  maxBound,
  valueMin,
  valueMax,
  onChange,
  disabled,
  label = "Platser",
}: Props) {
  const labelId = useId();
  const [active, setActive] = useState<"min" | "max" | null>(null);

  const span = maxBound - minBound;
  const safeSpan = span <= 0 ? 1 : span;
  const toPct = (v: number) =>
    ((clamp(v, minBound, maxBound) - minBound) / safeSpan) * 100;
  const loPct = toPct(Math.min(valueMin, valueMax));
  const hiPct = toPct(Math.max(valueMin, valueMax));

  const commit = useCallback(
    (minV: number, maxV: number) => {
      let a = clamp(Math.round(minV), minBound, maxBound);
      let b = clamp(Math.round(maxV), minBound, maxBound);
      if (a > b) [a, b] = [b, a];
      onChange({ min: a, max: b });
    },
    [minBound, maxBound, onChange],
  );

  const onMinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    const nextMin = clamp(v, minBound, valueMax);
    commit(nextMin, valueMax);
  };

  const onMaxInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    const nextMax = clamp(v, valueMin, maxBound);
    commit(valueMin, nextMax);
  };

  const rangeClass =
    "pointer-events-none absolute h-2 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-te-accent [&::-webkit-slider-thumb]:bg-te-elevated [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-te-accent [&::-moz-range-thumb]:bg-te-elevated [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.12)] active:[&::-moz-range-thumb]:cursor-grabbing";

  const zMin = active === "min" ? "z-30" : "z-20";
  const zMax = active === "max" ? "z-30" : "z-20";

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-te-muted text-sm font-medium">
          {label}
        </span>
        <span
          className="font-display text-te-text text-sm font-semibold tabular-nums"
          aria-live="polite"
        >
          {valueMin}–{valueMax}
        </span>
      </div>
      <div className="relative mt-3 h-9" role="group" aria-labelledby={labelId}>
        <div
          className="bg-te-border/70 pointer-events-none absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
          aria-hidden
        />
        <div
          className="from-te-accent/25 via-te-accent/45 to-te-accent/25 pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          style={{
            left: `${loPct}%`,
            width: `${Math.max(hiPct - loPct, 0)}%`,
          }}
          aria-hidden
        />
        <input
          type="range"
          min={minBound}
          max={maxBound}
          step={1}
          value={valueMin}
          disabled={disabled}
          aria-label="Minsta antal platser"
          className={`${rangeClass} ${zMin} top-1/2 w-full -translate-y-1/2`}
          onChange={onMinInput}
          onPointerDown={() => setActive("min")}
          onPointerUp={() => setActive(null)}
          onPointerCancel={() => setActive(null)}
        />
        <input
          type="range"
          min={minBound}
          max={maxBound}
          step={1}
          value={valueMax}
          disabled={disabled}
          aria-label="Högsta antal platser"
          className={`${rangeClass} ${zMax} top-1/2 w-full -translate-y-1/2`}
          onChange={onMaxInput}
          onPointerDown={() => setActive("max")}
          onPointerUp={() => setActive(null)}
          onPointerCancel={() => setActive(null)}
        />
      </div>
      <div
        className="text-te-muted/90 mt-1 flex justify-between font-mono text-[0.65rem] font-medium tracking-wider uppercase"
        aria-hidden
      >
        <span>{minBound}</span>
        <span>{maxBound}</span>
      </div>
    </div>
  );
}
