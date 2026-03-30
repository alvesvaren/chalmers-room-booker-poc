import { useEffect } from "react";
import { client } from "../client/client.gen";
import { API_BASE, JWT_STORAGE_KEY } from "../config/api";

/**
 * Keeps the OpenAPI client base URL + bearer token in sync with React auth state,
 * and mirrors the JWT to localStorage for reload persistence.
 *
 * Updates `client` config during render so the first post-login requests (e.g. Suspense
 * queries in children) already send `Authorization` — `useEffect` would run too late.
 */
export function useApiClientAuth(token: string) {
  client.setConfig({
    baseUrl: API_BASE,
    auth: () => token || undefined,
  });

  useEffect(() => {
    try {
      if (token) localStorage.setItem(JWT_STORAGE_KEY, token);
      else localStorage.removeItem(JWT_STORAGE_KEY);
    } catch {
      /* storage may be unavailable (private mode, policy) */
    }
  }, [token]);
}
