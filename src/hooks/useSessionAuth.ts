import { useEffect, useRef } from "react";
import { client } from "../client/client.gen";
import { AUTH_LOGIN_PATH, TIMEEDIT_AUTH_FAILED_ERROR } from "../config/api";
import i18n from "../i18n/i18n";
import { parseGatewayErrorBodyJson } from "../lib/errors";
import { jwtExpiresAtMs } from "../lib/jwtAccountLabel";

/**
 * Logs the user out on gateway auth failures (401 or TimeEdit 502), with de-duplication
 * when multiple requests fail at once.
 */
export function useAuthFailureInterceptor(
  token: string,
  logOut: () => void,
  onSessionToast: (message: string) => void,
) {
  const tokenRef = useRef(token);
  const authFailureHandled = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
    if (token) authFailureHandled.current = false;
  }, [token]);

  useEffect(() => {
    const id = client.interceptors.response.use(async (response, request) => {
      const path = new URL(request.url).pathname;
      const isLogin =
        path === AUTH_LOGIN_PATH || path.endsWith(AUTH_LOGIN_PATH);
      const hadToken = Boolean(tokenRef.current);

      if (response.status === 401 && !isLogin && hadToken) {
        if (!authFailureHandled.current) {
          authFailureHandled.current = true;
          logOut();
          onSessionToast(i18n.t("session.expired"));
        }
        return response;
      }

      if (response.status === 502 && !isLogin && hadToken) {
        const text = await response.clone().text();
        const body = parseGatewayErrorBodyJson(text);
        if (
          body?.error === TIMEEDIT_AUTH_FAILED_ERROR &&
          !authFailureHandled.current
        ) {
          authFailureHandled.current = true;
          logOut();
          onSessionToast(i18n.t("session.timeEditRejected"));
        }
      }

      return response;
    });
    return () => client.interceptors.response.eject(id);
  }, [logOut, onSessionToast]);
}

/**
 * When the JWT includes `exp`, logs out at that instant without waiting for a failing request.
 * Tokens without `exp` rely on API 401 handling only.
 */
export function useJwtExpiryLogout(
  token: string,
  logOut: () => void,
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
