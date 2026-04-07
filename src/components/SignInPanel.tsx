import { useTranslation } from "react-i18next";
import { errorMessage } from "../lib/errors";
import { Button } from "./ui/Button";

export function SignInPanel({
  username,
  password,
  onUsername,
  onPassword,
  onSubmit,
  isPending,
  submitError,
}: {
  username: string;
  password: string;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  submitError: unknown | null;
}) {
  const { t } = useTranslation();
  const inputClass =
    "w-full rounded-lg border border-te-border bg-te-elevated px-3 py-2.5 text-base text-te-text outline-none transition-shadow placeholder:text-te-muted/70 focus:border-te-accent focus:ring-2 focus:ring-te-accent/20 sm:text-sm";

  return (
    <section className="te-reveal border-te-border bg-te-surface rounded-2xl border p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-te-text text-xl font-semibold tracking-tight">
        {t("auth.signIn")}
      </h2>

      <form
        className="mt-6 flex max-w-xl flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
          <span className="text-te-text font-medium">{t("auth.username")}</span>
          <input
            className={inputClass}
            autoComplete="username"
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            placeholder={t("auth.usernamePlaceholder")}
            required
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
          <span className="text-te-text font-medium">{t("auth.password")}</span>
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
          {isPending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>

      {!!submitError && (
        <p className="text-te-danger mt-4 text-sm" role="alert">
          {errorMessage(submitError)}
        </p>
      )}
    </section>
  );
}
