/**
 * Read-only decode of a JWT payload for UI (no signature verification).
 * Prefers the local part of `email` (CID-style id before @), then `username`.
 */
export function accountLabelFromJwt(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  if (parts.length < 2) return null;
  let payload = parts[1];
  const padLen = (4 - (payload.length % 4)) % 4;
  if (padLen) payload += "=".repeat(padLen);
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json) as { email?: unknown; username?: unknown };
    if (typeof data.email === "string") {
      const at = data.email.indexOf("@");
      if (at > 0) return data.email.slice(0, at);
    }
    if (typeof data.username === "string" && data.username.length > 0) {
      return data.username;
    }
    return null;
  } catch {
    return null;
  }
}
