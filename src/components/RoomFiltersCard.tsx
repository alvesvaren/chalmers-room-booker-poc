import { CapacityRangeSlider } from "./ui/CapacityRangeSlider";
import { SortModeControl } from "./SortModeControl";
import type { RoomSort } from "../lib/roomSort";

const FIELD_LABEL =
  "text-te-muted text-sm font-medium leading-tight";
const FIELD_STACK = "flex min-w-0 flex-col gap-1.5";
const CONTROL =
  "box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-te-border bg-te-elevated px-3 text-base text-te-text shadow-none outline-none transition-[box-shadow,background-color] placeholder:text-te-muted/70 focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:h-10 sm:text-sm";

export type RoomFiltersCardProps = {
  nameFieldId: string;
  nameLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  capacityBounds: { min: number; max: number };
  capacityMin: number;
  capacityMax: number;
  onCapacityRangeChange: (next: { min: number; max: number }) => void;
  capacityDisabled: boolean;
  sort: RoomSort;
  onSortChange: (sort: RoomSort) => void;
  sortDisabled: boolean;
};

export function RoomFiltersCard({
  nameFieldId,
  nameLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  capacityBounds,
  capacityMin,
  capacityMax,
  onCapacityRangeChange,
  capacityDisabled,
  sort,
  onSortChange,
  sortDisabled,
}: RoomFiltersCardProps) {
  return (
    <div className="border-te-border/80 bg-te-surface/40 overflow-hidden rounded-xl border shadow-sm dark:bg-te-surface/20">
      <div className="divide-te-border/55 divide-y">
        <div className={`${FIELD_STACK} px-4 py-4 sm:px-5 sm:py-4`}>
          <label className={FIELD_LABEL} htmlFor={nameFieldId}>
            {nameLabel}
          </label>
          <input
            id={nameFieldId}
            className={CONTROL}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        <div className="px-4 py-5 sm:px-5 sm:py-6">
          <CapacityRangeSlider
            minBound={capacityBounds.min}
            maxBound={capacityBounds.max}
            valueMin={capacityMin}
            valueMax={capacityMax}
            onChange={onCapacityRangeChange}
            disabled={capacityDisabled}
          />
        </div>
        <div className="px-4 py-4 sm:px-5 sm:py-4">
          <SortModeControl
            value={sort}
            onChange={onSortChange}
            disabled={sortDisabled}
          />
        </div>
      </div>
    </div>
  );
}
