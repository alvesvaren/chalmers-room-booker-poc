import type { DehydratedState } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

/** Single app-local React Query cache bucket; cleared on explicit logout. */
export const REACT_QUERY_PERSIST_STORAGE_KEY = "chalmers-room-booker-rq-v1";

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

/**
 * After reading React Query persist JSON, mark every dehydrated query as having unknown
 * `dataUpdatedAt` so `isStale` is true until the first network fetch of this page load.
 */
export function markPersistedClientUnverified(client: PersistedClient): PersistedClient {
  const queries = client.clientState.queries;
  if (!queries?.length) {
    return client;
  }
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: queries.map((q) => {
        if (!q.state || typeof q.state !== "object") return q;
        return {
          ...q,
          state: {
            ...q.state,
            dataUpdatedAt: 0,
          },
        };
      }),
    },
  };
}
