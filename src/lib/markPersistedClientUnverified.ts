import type { PersistedClient } from "@tanstack/react-query-persist-client";

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
