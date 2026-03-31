import type { Room, RoomWithReservations } from "../client/types.gen";

/**
 * Merge a room directory row with schedule payload from GET /api/bookings.
 * Consumers should depend on this helper instead of duplicating merge logic.
 */
export function roomWithBookingsFor(
  room: Room,
  scheduleRooms: RoomWithReservations[] | undefined,
): RoomWithReservations {
  const hit = scheduleRooms?.find((r) => r.id === room.id);
  if (hit) return hit;
  return {
    ...room,
    bookings: [],
  };
}
