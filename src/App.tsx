import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { postApiAuthLoginMutation } from "./client/@tanstack/react-query.gen";
import { API_BASE, TOAST_DURATION_MS } from "./config/api";
import { AuthenticatedWorkspace } from "./components/AuthenticatedWorkspace";
import { SignInPanel } from "./components/SignInPanel";
import { useApiClientAuth } from "./hooks/useApiClientAuth";
import { useAuthFailureInterceptor } from "./hooks/useAuthFailureInterceptor";
import { useAutoDismiss } from "./hooks/useAutoDismiss";
import { useSessionToken } from "./hooks/useSessionToken";
import { reactQueryPersistStorageKey } from "./lib/reactQueryPersistKey";
import { accountLabelFromJwt } from "./lib/jwtAccountLabel";
import { Button } from "./components/ui/Button";

export default function App({
  session,
}: {
  session: ReturnType<typeof useSessionToken>;
}) {
  const queryClient = useQueryClient();
  const { token, setToken, authed } = session;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  const logOut = useCallback(() => {
    if (token) {
      void createAsyncStoragePersister({
        storage: window.localStorage,
        key: reactQueryPersistStorageKey(token),
      }).removeClient();
    }
    setToken("");
    void queryClient.invalidateQueries();
    void queryClient.clear();
  }, [queryClient, setToken, token]);

  useApiClientAuth(token);
  useAuthFailureInterceptor(token, logOut, setSessionToast);

  const clearSessionToast = useCallback(() => setSessionToast(null), []);
  useAutoDismiss(sessionToast, clearSessionToast, TOAST_DURATION_MS);

  const loginMutation = useMutation({
    ...postApiAuthLoginMutation(),
  });

  const accountLabel = useMemo(
    () => (token ? accountLabelFromJwt(token) : null),
    [token],
  );

  return (
    <div className="text-te-text min-h-svh antialiased">
      <div className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <header className="te-reveal border-te-border mb-8 flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-te-text text-3xl font-semibold tracking-tight sm:text-4xl">
              TimeEdit demo
            </h1>
            <p className="text-te-muted mt-2 max-w-2xl text-sm leading-relaxed">
              Grupprumsbokning · Chalmers-inloggning.
            </p>
          </div>
          {authed ? (
            <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
              {accountLabel ? (
                <span
                  className="text-te-text max-w-48 truncate text-sm font-medium sm:max-w-none"
                  title={accountLabel}
                >
                  {accountLabel}
                </span>
              ) : null}
              <Button variant="secondary" onClick={logOut}>
                Logga ut
              </Button>
            </div>
          ) : null}
        </header>

        {!authed ? (
          <SignInPanel
            username={username}
            password={password}
            onUsername={setUsername}
            onPassword={setPassword}
            onSubmit={() => {
              loginMutation.mutate(
                { body: { username, password } },
                {
                  onSuccess: (data) => {
                    setToken(data.token);
                    setPassword("");
                  },
                },
              );
            }}
            isPending={loginMutation.isPending}
            submitError={loginMutation.isError ? loginMutation.error : null}
          />
        ) : null}

        {sessionToast ? (
          <div
            className="border-te-border bg-te-elevated text-te-text fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg"
            role="status"
            aria-live="polite"
          >
            {sessionToast}
          </div>
        ) : null}

        {!authed ? (
          <p className="text-te-muted mt-8 text-center text-sm">
            Logga in för att se schema, rum och dina bokningar.
          </p>
        ) : (
          <AuthenticatedWorkspace />
        )}

        <footer className="border-te-border text-te-muted mt-16 border-t pt-6 text-center text-xs">
          <a
            className="text-te-accent font-medium underline-offset-4 hover:underline"
            href={API_BASE}
            target="_blank"
            rel="noreferrer"
          >
            API-wrapper
          </a>
        </footer>
      </div>
    </div>
  );
}
