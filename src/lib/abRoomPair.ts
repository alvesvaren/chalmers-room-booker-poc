import type { Room } from "../client/types.gen";

/** Only EG building split rooms use the A/B pair booking flow. */
export function isEgAbPairRoomName(name: string): boolean {
  return name.startsWith("EG-");
}

/** Chalmers-style paired halves: same base name ending in A or B (e.g. EG-3211A / EG-3211B). */
export function abRoomCompanionSuffix(name: string): "A" | "B" | null {
  const last = name.at(-1);
  if (last === "A") return "B";
  if (last === "B") return "A";
  return null;
}

export function abRoomCompanionName(name: string): string | null {
  const target = abRoomCompanionSuffix(name);
  if (!target) return null;
  return name.slice(0, -1) + target;
}

/** Returns the other half in `allRooms` if it exists, otherwise null. */
export function findAbRoomCompanion(
  room: Room,
  allRooms: Room[] | undefined,
): Room | null {
  if (!isEgAbPairRoomName(room.name)) return null;
  if (!allRooms?.length) return null;
  const companionName = abRoomCompanionName(room.name);
  if (!companionName) return null;
  return allRooms.find((r) => r.name === companionName) ?? null;
}
