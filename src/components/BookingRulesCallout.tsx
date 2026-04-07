import { useTranslation } from "react-i18next";

function normalizeRulesText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Policy copy from TimeEdit — simple collapsible, visually separate from the filter toolbar.
 */
export function BookingRulesCallout({ rules }: { rules: string }) {
  const { t } = useTranslation();
  const body = normalizeRulesText(rules);

  return (
    <details className="border-te-border/80 bg-te-elevated/25 group overflow-hidden rounded-xl border dark:bg-te-elevated/20">
      <summary className="text-te-text flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm outline-none marker:content-none transition-colors hover:bg-te-elevated/35 focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-te-accent/30 focus-visible:ring-inset dark:hover:bg-te-elevated/30 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <span className="font-display font-semibold tracking-tight">
            {t("schedule.bookingRules")}
          </span>
          <span className="text-te-muted text-xs font-normal">
            {t("schedule.rulesCalloutHint")}
          </span>
        </div>
        <span
          className="text-te-muted shrink-0 text-xs transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="border-te-border/60 text-te-muted border-t px-4 pt-2 pb-3 text-sm leading-relaxed sm:px-4">
        <div className="max-h-[min(24rem,58vh)] overflow-y-auto whitespace-pre-wrap">
          {body}
        </div>
      </div>
    </details>
  );
}
