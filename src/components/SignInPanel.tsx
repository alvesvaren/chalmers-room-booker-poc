import { errorMessage } from "../lib/errors";
import { Button } from "./ui/Button";

export function SignInPanel({
  authed,
  username,
  password,
  onUsername,
  onPassword,
  onSubmit,
  onLogOut,
  isPending,
  submitError,
}: {
  authed: boolean;
  username: string;
  password: string;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: () => void;
  onLogOut: () => void;
  isPending: boolean;
  submitError: unknown | null;
}) {
  const inputClass =
    "w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2.5 text-base text-te-text outline-none transition-shadow placeholder:text-te-muted/70 focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:text-sm";

  return (
    <section className="te-reveal rounded-2xl border border-te-border bg-te-surface p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-xl font-semibold tracking-tight text-te-text">
        Logga in
      </h2>

      {authed ? (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={onLogOut}>
            Logga ut
          </Button>
        </div>
      ) : (
        <form
          className="mt-6 flex max-w-xl flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-te-text">Användarnamn</span>
            <input
              className={inputClass}
              autoComplete="username"
              value={username}
              onChange={(e) => onUsername(e.target.value)}
              placeholder="cid@chalmers.se"
              required
            />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-te-text">Lösenord</span>
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => onPassword(e.target.value)}
              required
            />
          </label>
          <Button type="submit" disabled={isPending} className="sm:mb-0.5">
            {isPending ? "Loggar in…" : "Logga in"}
          </Button>
        </form>
      )}

      {submitError ? (
        <p className="mt-4 text-sm text-te-danger" role="alert">
          {errorMessage(submitError)}
        </p>
      ) : null}
    </section>
  );
}
