import { useEffect } from "react";
import i18n from "../i18n/i18n";
import { jwtExpiresAtMs } from "../lib/jwtAccountLabel";

type LogOut = () => void;

/**
 * When the JWT includes `exp`, logs out at that instant without waiting for a failing request.
 * Tokens without `exp` rely on API 401 handling only.
 */
export function useJwtExpiryLogout(
  token: string,
  logOut: LogOut,
  onSessionToast: (message: string) => void,
) {
  useEffect(() => {
    if (!token) return;
    const expMs = jwtExpiresAtMs(token);
    if (expMs == null) return;

    const runExpiry = () => {
      logOut();
      onSessionToast(i18n.t("session.expired"));
    };

    const remaining = expMs - Date.now();
    if (remaining <= 0) {
      runExpiry();
      return;
    }

    const id = window.setTimeout(runExpiry, remaining);
    return () => clearTimeout(id);
  }, [token, logOut, onSessionToast]);
}
