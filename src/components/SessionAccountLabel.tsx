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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!hovered || expiresAtMs == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hovered, expiresAtMs]);

  const title = useMemo(() => {
    if (expiresAtMs == null || !hovered) return accountLabel;
    const left = expiresAtMs - Date.now();
    if (left <= 0) {
      return t("session.expired");
    }
    return t("session.timeRemaining", {
      time: formatSessionTimeRemaining(left),
    });
  }, [accountLabel, expiresAtMs, hovered, t, tick]);

  return (
    <span
      className="text-te-text max-w-48 truncate text-sm font-medium sm:max-w-none"
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {accountLabel}
    </span>
  );
}
