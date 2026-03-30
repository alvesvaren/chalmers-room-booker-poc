import { useCallback, useState } from "react";
import { JWT_STORAGE_KEY } from "../config/api";

function readStoredJwt(): string {
  try {
    return localStorage.getItem(JWT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function useSessionToken() {
  const [token, setTokenState] = useState(readStoredJwt);

  const setToken = useCallback((next: string) => {
    setTokenState(next);
  }, []);

  return { token, setToken, authed: Boolean(token) };
}
