import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { RoomSort, SortMode } from "../lib/roomSort";

type Props = {
  value: RoomSort;
  onChange: (next: RoomSort) => void;
  disabled?: boolean;
};

const MODES: SortMode[] = ["rating", "name", "capacity"];

/** ▾ / ▴ hints primary sort direction (tap active pill again to flip). */
function directionMark(mode: SortMode, invert: boolean): string {
  if (mode === "rating") return invert ? " ▴" : " ▾";
  return invert ? " ▾" : " ▴";
}

export function SortModeControl({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const labelId = useId();

  const optionLabel = (m: SortMode) =>
    m === "rating"
      ? t("rooms.sortRating")
      : m === "name"
        ? t("rooms.sortName")
        : t("rooms.sortCapacity");

  const handleClick = (m: SortMode) => {
    if (disabled) return;
    if (m === value.mode) {
      onChange({ mode: m, invert: !value.invert });
    } else {
      onChange({ mode: m, invert: false });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span
        id={labelId}
        className="text-te-muted text-sm font-medium leading-tight"
      >
        {t("rooms.sort")}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
      >
        {MODES.map((m) => {
          const active = value.mode === m;
          const mark = active ? directionMark(m, value.invert) : "";
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              title={
                active
                  ? t("rooms.sortTapAgainToReverse")
                  : t("rooms.sortTapToSelect")
              }
              disabled={disabled}
              onClick={() => handleClick(m)}
              className={
                active
                  ? "rounded-lg bg-te-accent px-3.5 py-2 text-xs font-semibold text-te-surface shadow-sm focus-visible:ring-2 focus-visible:ring-te-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-te-surface focus-visible:outline-none sm:text-sm dark:ring-offset-te-elevated"
                  : "rounded-lg border border-te-border bg-te-surface/60 px-3.5 py-2 text-xs font-medium text-te-muted transition-colors hover:border-te-accent/35 hover:text-te-text focus-visible:ring-2 focus-visible:ring-te-accent/25 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 sm:text-sm dark:bg-te-elevated/40"
              }
            >
              <span className="tabular-nums">
                {optionLabel(m)}
                <span aria-hidden className="font-sans">
                  {mark}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { RoomSort, SortMode } from "../lib/roomSort";
