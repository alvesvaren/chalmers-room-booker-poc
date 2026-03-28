import type { RoomRatingEntry } from "../data/roomRatings.gen.ts";
import roomRatings from "../data/roomRatings.gen.ts";

export type { RoomRatingEntry };

export function getRoomRating(roomName: string): RoomRatingEntry | undefined {
  return roomRatings[roomName];
}

/** Sort key: higher overall first; missing ratings last. */
export function ratingSortValue(roomName: string): number {
  return roomRatings[roomName]?.overall ?? Number.NEGATIVE_INFINITY;
}
