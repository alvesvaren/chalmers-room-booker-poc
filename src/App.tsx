import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense, useCallback, useState } from "react";
import { postApiAuthLoginMutation } from "./client/@tanstack/react-query.gen";
import { API_BASE, TOAST_DURATION_MS } from "./config/api";
import { AuthenticatedWorkspace } from "./components/AuthenticatedWorkspace";
import { QueryErrorBoundary } from "./components/QueryErrorBoundary";
import { SignInPanel } from "./components/SignInPanel";
import { WorkspaceSuspenseFallback } from "./components/skeletons/ScheduleGridSkeleton";
import { useApiClientAuth } from "./hooks/useApiClientAuth";
import { useAuthFailureInterceptor } from "./hooks/useAuthFailureInterceptor";
import { useAutoDismiss } from "./hooks/useAutoDismiss";
import { useSessionToken } from "./hooks/useSessionToken";

export default function App() {
  const queryClient = useQueryClient();
  const { token, setToken, authed } = useSessionToken();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  const logOut = useCallback(() => {
    setToken("");
    void queryClient.invalidateQueries();
    void queryClient.clear();
  }, [queryClient, setToken]);

  useApiClientAuth(token);
  useAuthFailureInterceptor(token, logOut, setSessionToast);

  const clearSessionToast = useCallback(() => setSessionToast(null), []);
  useAutoDismiss(sessionToast, clearSessionToast, TOAST_DURATION_MS);

  const loginMutation = useMutation({
    ...postApiAuthLoginMutation(),
  });

  return (
    <div className="min-h-svh antialiased text-te-text">
      <div className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <header className="te-reveal mb-8 border-b border-te-border pb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-te-text sm:text-4xl">
            TimeEdit demo
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-te-muted">
            Grupprumsbokning · Chalmers-inloggning.
          </p>
        </header>

        <SignInPanel
          authed={authed}
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
          onLogOut={logOut}
          isPending={loginMutation.isPending}
          submitError={loginMutation.isError ? loginMutation.error : null}
        />

        {sessionToast ? (
          <div
            className="fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-xl border border-te-border bg-te-elevated px-4 py-3 text-sm text-te-text shadow-lg"
            role="status"
            aria-live="polite"
          >
            {sessionToast}
          </div>
        ) : null}

        {!authed ? (
          <p className="mt-8 text-center text-sm text-te-muted">
            Logga in för att se schema, rum och dina bokningar.
          </p>
        ) : (
          <QueryErrorBoundary>
            <Suspense fallback={<WorkspaceSuspenseFallback />}>
              <AuthenticatedWorkspace />
            </Suspense>
          </QueryErrorBoundary>
        )}

        <footer className="mt-16 border-t border-te-border pt-6 text-center text-xs text-te-muted">
          <a
            className="font-medium text-te-accent underline-offset-4 hover:underline"
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
