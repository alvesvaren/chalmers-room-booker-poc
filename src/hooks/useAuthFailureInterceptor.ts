import { useEffect, useRef } from "react";
import { client } from "../client/client.gen";
import { AUTH_LOGIN_PATH, TIMEEDIT_AUTH_FAILED_ERROR } from "../config/api";
import { parseGatewayErrorBodyJson } from "../lib/gatewayErrorBody";

type LogOut = () => void;

/**
 * Logs the user out on gateway auth failures (401 or TimeEdit 502), with de-duplication
 * when multiple requests fail at once.
 */
export function useAuthFailureInterceptor(
  token: string,
  logOut: LogOut,
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
          onSessionToast(
            "Sessionen har gått ut eller är ogiltig. Logga in igen.",
          );
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
          onSessionToast(
            "TimeEdit accepterade inte inloggningen. Logga in igen.",
          );
        }
      }

      return response;
    });
    return () => client.interceptors.response.eject(id);
  }, [logOut, onSessionToast]);
}
