import type { DehydratedState } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const EMPTY_DEHYDRATED: DehydratedState = {
  mutations: [],
  queries: [],
};

/** Fresh snapshot when persisted cache is missing or corrupt. */
export function emptyPersistedClient(): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: "",
    clientState: EMPTY_DEHYDRATED,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function safeParsePersistedClient(raw: string): PersistedClient | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.timestamp !== "number" || typeof parsed.buster !== "string") {
    return null;
  }
  const cs = parsed.clientState;
  if (!isRecord(cs)) return null;
  if (!Array.isArray(cs.queries) || !Array.isArray(cs.mutations)) return null;
  return parsed as unknown as PersistedClient;
}
