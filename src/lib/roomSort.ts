import type { Room } from "../client/types.gen";
import { ratingSortValue } from "./roomRatings";

export type SortMode = "rating" | "name" | "capacity";

/** `invert` flips the primary comparison from its default for that mode. */
export type RoomSort = { mode: SortMode; invert: boolean };

export function compareRoomsForSort(
  a: Room,
  b: Room,
  sort: RoomSort,
  collatorLocale: string,
): number {
  const tie = () => a.name.localeCompare(b.name, collatorLocale);
  let cmp: number;
  if (sort.mode === "rating") {
    cmp = ratingSortValue(b.name) - ratingSortValue(a.name);
    if (cmp === 0) return tie();
    return sort.invert ? -cmp : cmp;
  }
  if (sort.mode === "name") {
    cmp = a.name.localeCompare(b.name, collatorLocale);
    if (cmp === 0) return 0;
    return sort.invert ? -cmp : cmp;
  }
  const ca = a.capacity ?? -1;
  const cb = b.capacity ?? -1;
  cmp = ca - cb;
  if (cmp === 0) return tie();
  return sort.invert ? -cmp : cmp;
}
