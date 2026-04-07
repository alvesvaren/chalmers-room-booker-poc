import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  formatSessionTimeRemaining,
  jwtExpiresAtMs,
} from "../lib/jwtAccountLabel";

export function SessionAccountLabel({
  token,
  accountLabel,
}: {
  token: string;
  accountLabel: string;
}) {
  const { t } = useTranslation();
  const expiresAtMs = useMemo(() => jwtExpiresAtMs(token), [token]);
  const [hovered, setHovered] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!hovered || expiresAtMs == null) return;
    const tick = () => setNowMs(Date.now());
    const initial = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initial);
      clearInterval(id);
    };
  }, [hovered, expiresAtMs]);

  let title = accountLabel;
  if (expiresAtMs != null && hovered) {
    const left = expiresAtMs - nowMs;
    title =
      left <= 0
        ? t("session.expired")
        : t("session.timeRemaining", {
            time: formatSessionTimeRemaining(left),
          });
  }

  return (
    <span
      className="text-te-text max-w-48 truncate text-sm font-medium sm:max-w-none"
      title={title}
      onMouseEnter={() => {
        setHovered(true);
        setNowMs(Date.now());
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {accountLabel}
    </span>
  );
}
