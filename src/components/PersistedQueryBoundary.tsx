import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { QUERY_STALE_TIME_MS } from "../config/query";
import {
  REACT_QUERY_PERSIST_STORAGE_KEY,
  emptyPersistedClient,
  markPersistedClientUnverified,
  safeParsePersistedClient,
} from "../lib/reactQueryPersist";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function PersistedQueryBoundary({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            gcTime: MAX_AGE_MS,
            staleTime: QUERY_STALE_TIME_MS,
          },
          mutations: {
            retry: false,
          },
        },
      }),
    [],
  );

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: window.localStorage,
        key: REACT_QUERY_PERSIST_STORAGE_KEY,
        throttleTime: 1000,
        deserialize: (cachedString) => {
          const parsed = safeParsePersistedClient(cachedString);
          if (parsed == null) {
            console.warn(
              "[react-query-persist] Ignoring corrupt or invalid cache entry",
            );
            return markPersistedClientUnverified(emptyPersistedClient());
          }
          return markPersistedClientUnverified(parsed);
        },
      }),
    [],
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: MAX_AGE_MS,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
