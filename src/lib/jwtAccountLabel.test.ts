import { describe, expect, it } from "vitest";
import {
  accountLabelFromJwt,
  formatSessionTimeRemaining,
  jwtExpiresAtMs,
} from "./jwtAccountLabel";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.x`;
}

describe("accountLabelFromJwt", () => {
  it("uses email local-part when present", () => {
    expect(
      accountLabelFromJwt(
        fakeJwt({ email: "alvel@student.chalmers.se", username: "ignored" }),
      ),
    ).toBe("alvel");
  });

  it("falls back to username", () => {
    expect(accountLabelFromJwt(fakeJwt({ username: "abc123" }))).toBe("abc123");
  });

  it("returns null for invalid token", () => {
    expect(accountLabelFromJwt("not-a-jwt")).toBe(null);
    expect(accountLabelFromJwt("")).toBe(null);
  });
});

describe("jwtExpiresAtMs", () => {
  it("reads exp as unix seconds", () => {
    const expSec = 1_700_000_000;
    const ms = jwtExpiresAtMs(fakeJwt({ exp: expSec }));
    expect(ms).toBe(expSec * 1000);
  });

  it("returns null when exp is missing or not a number", () => {
    expect(jwtExpiresAtMs(fakeJwt({ email: "a@b" }))).toBe(null);
    expect(jwtExpiresAtMs(fakeJwt({ exp: "nope" }))).toBe(null);
  });
});

describe("formatSessionTimeRemaining", () => {
  it("formats hours and minutes", () => {
    expect(formatSessionTimeRemaining(3661_000)).toBe("1h 1m");
  });

  it("formats minutes and seconds", () => {
    expect(formatSessionTimeRemaining(125_000)).toBe("2m 5s");
  });

  it("formats seconds only under one minute", () => {
    expect(formatSessionTimeRemaining(45_000)).toBe("45s");
  });

  it("handles non-positive as 0:00", () => {
    expect(formatSessionTimeRemaining(0)).toBe("0:00");
    expect(formatSessionTimeRemaining(-1)).toBe("0:00");
  });
});
