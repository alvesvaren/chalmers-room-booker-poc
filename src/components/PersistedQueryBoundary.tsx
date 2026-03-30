import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { QUERY_STALE_TIME_MS } from "../config/query";
import { markPersistedClientUnverified } from "../lib/markPersistedClientUnverified";
import { reactQueryPersistStorageKey } from "../lib/reactQueryPersistKey";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function PersistQueryClientLayer({
  storageScope,
  children,
}: {
  storageScope: string;
  children: ReactNode;
}) {
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
        key: storageScope,
        throttleTime: 1000,
        deserialize: (cachedString) => {
          const parsed = JSON.parse(cachedString) as PersistedClient;
          return markPersistedClientUnverified(parsed);
        },
      }),
    [storageScope],
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

export function PersistedQueryBoundary({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const storageScope = reactQueryPersistStorageKey(token);
  return (
    <PersistQueryClientLayer key={storageScope} storageScope={storageScope}>
      {children}
    </PersistQueryClientLayer>
  );
}
