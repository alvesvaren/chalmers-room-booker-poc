type JwtPayload = {
  email?: unknown;
  username?: unknown;
  exp?: unknown;
};

/** Read-only payload decode (no signature verification). */
function decodeJwtPayload(token: string): JwtPayload | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  if (parts.length < 2) return null;
  let payload = parts[1];
  const padLen = (4 - (payload.length % 4)) % 4;
  if (padLen) payload += "=".repeat(padLen);
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Unix ms when the JWT `exp` claim lapses, or null if missing or invalid. */
export function jwtExpiresAtMs(token: string): number | null {
  const data = decodeJwtPayload(token);
  if (typeof data?.exp !== "number" || !Number.isFinite(data.exp)) return null;
  return data.exp * 1000;
}

/** Compact remaining time for tooltips (not localized; paired with i18n wrapper string). */
export function formatSessionTimeRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Read-only decode of a JWT payload for UI (no signature verification).
 * Prefers the local part of `email` (CID-style id before @), then `username`.
 */
export function accountLabelFromJwt(token: string): string | null {
  const data = decodeJwtPayload(token);
  if (!data) return null;
  if (typeof data.email === "string") {
    const at = data.email.indexOf("@");
    if (at > 0) return data.email.slice(0, at);
  }
  if (typeof data.username === "string" && data.username.length > 0) {
    return data.username;
  }
  return null;
}
