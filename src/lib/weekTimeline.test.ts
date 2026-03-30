import { describe, expect, it } from "vitest";
import {
  getWeekRange,
  snapInstantMsToQuarterOnDate,
  weekOffsetForLocalDate,
} from "./weekTimeline";

describe("getWeekRange", () => {
  it("uses Monday start in local time and 7-day span to exclusive end", () => {
    const wed = new Date(2025, 0, 15, 14, 30, 0, 0);
    const { weekStart, weekEnd } = getWeekRange(0, wed);
    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getFullYear()).toBe(2025);
    expect(weekStart.getMonth()).toBe(0);
    expect(weekStart.getDate()).toBe(13);
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it("shifts by whole weeks with weekOffset", () => {
    const anchor = new Date(2025, 0, 15);
    const w0 = getWeekRange(0, anchor).weekStart;
    const w1 = getWeekRange(1, anchor).weekStart;
    expect(w1.getTime() - w0.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("weekOffsetForLocalDate", () => {
  it("counts Monday-based calendar weeks from anchor week", () => {
    const anchor = new Date(2025, 0, 15);
    expect(weekOffsetForLocalDate("2025-01-13", anchor)).toBe(0);
    expect(weekOffsetForLocalDate("2025-01-20", anchor)).toBe(1);
    expect(weekOffsetForLocalDate("2025-01-06", anchor)).toBe(-1);
  });

  it("returns 0 for invalid date string", () => {
    expect(weekOffsetForLocalDate("abcd", new Date())).toBe(0);
  });
});

describe("snapInstantMsToQuarterOnDate", () => {
  it("snaps to 15 minutes on the given local calendar day", () => {
    const day0 = new Date(2026, 5, 10, 0, 0, 0, 0).getTime();
    const ms = day0 + 60_000 * 10;
    const snapped = snapInstantMsToQuarterOnDate(ms, "2026-06-10");
    expect((snapped - day0) % (15 * 60_000)).toBe(0);
    expect(snapped).toBe(day0 + 15 * 60_000);
  });
});
