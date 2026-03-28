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
