import { describe, expect, it } from "vitest";
import {
  localWallClockMs,
  parseInstantOnDate,
  parseNaiveLocal,
  startOfLocalDayMs,
} from "./parse";

describe("localWallClockMs", () => {
  it("returns consistent ms for date + time in local wall-clock", () => {
    const ms = localWallClockMs("2026-03-02", "09:15");
    const d = new Date(2026, 2, 2, 9, 15, 0, 0);
    expect(ms).toBe(d.getTime());
  });

  it("returns NaN for invalid parts", () => {
    expect(Number.isNaN(localWallClockMs("x", "09:00"))).toBe(true);
    expect(Number.isNaN(localWallClockMs("2026-01-01", "noon"))).toBe(true);
  });
});

describe("parseNaiveLocal", () => {
  it("accepts space-separated naive ISO", () => {
    const d = parseNaiveLocal("2026-03-02 09:15:00");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(15);
  });

  it("throws on garbage", () => {
    expect(() => parseNaiveLocal("not-a-date")).toThrow(/Invalid datetime/);
  });
});

describe("startOfLocalDayMs", () => {
  it("aligns with local midnight for YYYY-MM-DD", () => {
    const laterSameDay = new Date(2026, 2, 2, 15, 0, 0, 0);
    const mid = startOfLocalDayMs("2026-03-02");
    expect(mid).toBe(new Date(2026, 2, 2, 0, 0, 0, 0).getTime());
    expect(mid).toBeLessThanOrEqual(laterSameDay.getTime());
  });
});

describe("parseInstantOnDate", () => {
  it("matches localWallClockMs", () => {
    const d = parseInstantOnDate("2026-07-01", "00:00");
    expect(d.getTime()).toBe(localWallClockMs("2026-07-01", "00:00"));
  });
});
