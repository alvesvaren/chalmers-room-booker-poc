import { describe, expect, it } from "vitest";
import { accountLabelFromJwt } from "./jwtAccountLabel";

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
