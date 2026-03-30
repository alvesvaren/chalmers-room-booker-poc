import type { Room, RoomWithBookings } from "../client/types.gen";

export const CAPACITY_SLIDER_FALLBACK_MAX = 60;

/** Lower bound is always 1 so the slider stays predictable for small rooms. */
export function capacitySliderBounds(rooms: Array<Room | RoomWithBookings> | undefined): { min: number; max: number } {
  let hi = 0;
  for (const r of rooms ?? []) {
    const c = r.capacity;
    if (c != null && Number.isFinite(c)) hi = Math.max(hi, c);
  }
  if (hi < 1) return { min: 1, max: CAPACITY_SLIDER_FALLBACK_MAX };
  return { min: 1, max: Math.max(hi, 8) };
}

export function roomMatchesCapacityFilter(room: { capacity: number | null }, minSeats: number, maxSeats: number): boolean {
  if (room.capacity == null) return true;
  return room.capacity >= minSeats && room.capacity <= maxSeats;
}

export function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Keep slider selection inside observed room capacities; if inverted, reset to full span. */
export function displayCapacityRange(
  bounds: { min: number; max: number },
  selection: { min: number; max: number },
): { min: number; max: number } {
  const lo = bounds.min;
  const hi = bounds.max;
  const a = clampInt(selection.min, lo, hi);
  const b = clampInt(selection.max, lo, hi);
  if (a > b) return { min: lo, max: hi };
  return { min: a, max: b };
}
