import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { postApiAuthLoginMutation } from "./client/@tanstack/react-query.gen";
import { API_BASE, TOAST_DURATION_MS } from "./config/api";
import { AuthenticatedWorkspace } from "./components/AuthenticatedWorkspace";
import { SignInPanel } from "./components/SignInPanel";
import { SessionAccountLabel } from "./components/SessionAccountLabel";
import { useApiClientAuth } from "./hooks/useApiClientAuth";
import {
  useAuthFailureInterceptor,
  useJwtExpiryLogout,
} from "./hooks/useSessionAuth";
import { useAutoDismiss } from "./hooks/useUiEffects";
import { useSessionToken } from "./hooks/useSessionToken";
import { REACT_QUERY_PERSIST_STORAGE_KEY } from "./lib/reactQueryPersist";
import { accountLabelFromJwt } from "./lib/jwtAccountLabel";
import { LocaleSwitcher } from "./components/LocaleSwitcher";
import { Button } from "./components/ui/Button";

export default function App({
  session,
}: {
  session: ReturnType<typeof useSessionToken>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { token, setToken, authed } = session;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  const logOut = useCallback(() => {
    void createAsyncStoragePersister({
      storage: window.localStorage,
      key: REACT_QUERY_PERSIST_STORAGE_KEY,
    }).removeClient();
    setToken("");
    void queryClient.invalidateQueries();
    void queryClient.clear();
  }, [queryClient, setToken]);

  useApiClientAuth(token);
  useAuthFailureInterceptor(token, logOut, setSessionToast);
  useJwtExpiryLogout(token, logOut, setSessionToast);

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
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <header className="te-reveal border-te-border mb-8 flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-te-text text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("app.title")}
            </h1>
            <p className="text-te-muted mt-2 max-w-2xl text-sm leading-relaxed">
              {t("app.subtitle")}
            </p>
          </div>
          {authed && (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              {accountLabel && (
                <SessionAccountLabel
                  token={token}
                  accountLabel={accountLabel}
                />
              )}
              <Button variant="secondary" onClick={logOut}>
                {t("app.signOut")}
              </Button>
            </div>
          )}
        </header>

        {!authed && (
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
        )}

        {sessionToast && (
          <div
            className="border-te-border bg-te-elevated text-te-text fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg"
            role="status"
            aria-live="polite"
          >
            {sessionToast}
          </div>
        )}

        {!authed ? (
          <p className="text-te-muted mt-8 text-center text-sm">
            {t("app.signInHint")}
          </p>
        ) : (
          <AuthenticatedWorkspace />
        )}

        <footer className="border-te-border text-te-muted mt-16 border-t pt-6 text-xs">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <a
              className="text-te-accent text-center font-medium underline-offset-4 hover:underline"
              href={API_BASE}
              target="_blank"
              rel="noreferrer"
            >
              {t("app.apiLink")}
            </a>
            <LocaleSwitcher />
          </div>
        </footer>
      </div>
    </div>
  );
}
