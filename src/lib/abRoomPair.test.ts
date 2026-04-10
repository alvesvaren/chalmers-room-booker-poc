import { describe, expect, it } from "vitest";
import {
  abRoomCompanionName,
  abRoomCompanionSuffix,
  findAbRoomCompanion,
  isEgAbPairRoomName,
} from "./abRoomPair";
import type { Room } from "../client/types.gen";

function room(id: string, name: string): Room {
  return { id, name, capacity: 4, equipment: "", campus: "Johanneberg" };
}

describe("abRoomCompanionSuffix", () => {
  it("returns B for names ending in A", () => {
    expect(abRoomCompanionSuffix("EG-3211A")).toBe("B");
  });
  it("returns A for names ending in B", () => {
    expect(abRoomCompanionSuffix("EG-3211B")).toBe("A");
  });
  it("returns null when suffix is not A/B", () => {
    expect(abRoomCompanionSuffix("EG-3211")).toBeNull();
    expect(abRoomCompanionSuffix("")).toBeNull();
  });
});

describe("abRoomCompanionName", () => {
  it("swaps trailing A/B", () => {
    expect(abRoomCompanionName("EG-3211A")).toBe("EG-3211B");
    expect(abRoomCompanionName("EG-3211B")).toBe("EG-3211A");
  });
});

describe("isEgAbPairRoomName", () => {
  it("is true only for EG- prefix", () => {
    expect(isEgAbPairRoomName("EG-3211A")).toBe(true);
    expect(isEgAbPairRoomName("ED-3211A")).toBe(false);
  });
});

describe("findAbRoomCompanion", () => {
  const rooms: Room[] = [
    room("1", "EG-3211A"),
    room("2", "EG-3211B"),
    room("3", "Other"),
  ];

  it("finds the paired room by name", () => {
    expect(findAbRoomCompanion(rooms[0], rooms)).toEqual(rooms[1]);
    expect(findAbRoomCompanion(rooms[1], rooms)).toEqual(rooms[0]);
  });

  it("returns null when companion is missing from list", () => {
    expect(findAbRoomCompanion(room("x", "EG-9999A"), [room("x", "EG-9999A")])).toBeNull();
  });

  it("does not pair non-EG A/B rooms", () => {
    const ed: Room[] = [room("a", "ED-100A"), room("b", "ED-100B")];
    expect(findAbRoomCompanion(ed[0], ed)).toBeNull();
  });
});
