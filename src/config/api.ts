/** Base URL for the TimeEdit API wrapper (Vite app talks to this host). */
export const API_BASE = "https://timeedit.svaren.dev";

export const AUTH_LOGIN_PATH = "/api/auth/login";

export const JWT_STORAGE_KEY = "timeedit-demo-jwt";

export const TOAST_DURATION_MS = 4200;

/** Server JSON body when TimeEdit cookie exchange failed (HTTP 502). */
export const TIMEEDIT_AUTH_FAILED_ERROR = "TimeEdit authentication failed";
