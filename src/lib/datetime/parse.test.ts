import { describe, expect, it } from "vitest";
import {
  addLocalCalendarDays,
  formatCreateBookingInterval,
  localWallClockMs,
  parseApiInterval,
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

describe("addLocalCalendarDays", () => {
  it("shifts wire date by whole days in local calendar", () => {
    expect(addLocalCalendarDays("2026-03-02", 1)).toBe("2026-03-03");
    expect(addLocalCalendarDays("2026-03-02", -1)).toBe("2026-03-01");
    expect(addLocalCalendarDays("2026-03-02", 0)).toBe("2026-03-02");
  });

  it("returns original on invalid wire date", () => {
    expect(addLocalCalendarDays("not-a-date", 1)).toBe("not-a-date");
  });
});

describe("parseApiInterval", () => {
  it("parses same-day HH:mm end part", () => {
    const { start, end } = parseApiInterval("2026-03-31T09:15/11:15");
    expect(start.getTime()).toBe(
      parseNaiveLocal("2026-03-31T09:15").getTime(),
    );
    expect(end.getTime()).toBe(parseInstantOnDate("2026-03-31", "11:15").getTime());
  });

  it("parses full end datetime", () => {
    const { start, end } = parseApiInterval(
      "2026-03-30T22:00/2026-03-31T02:00",
    );
    expect(start.getTime()).toBe(parseNaiveLocal("2026-03-30T22:00").getTime());
    expect(end.getTime()).toBe(parseNaiveLocal("2026-03-31T02:00").getTime());
  });

  it("throws without slash", () => {
    expect(() => parseApiInterval("2026-03-31T09:15")).toThrow(
      /expected start\/end/,
    );
  });
});

describe("formatCreateBookingInterval", () => {
  it("builds same-day interval wire", () => {
    expect(formatCreateBookingInterval("2026-04-01", "09:00", "10:15")).toBe(
      "2026-04-01T09:00/10:15",
    );
  });
});
