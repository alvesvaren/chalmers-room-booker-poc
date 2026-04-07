import i18n from "../../i18n/i18n";

/** BCP 47 tag for dates, times, and collation — follows the active UI language. */
export function appLocaleBcp47(): string {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  if (lng.startsWith("sv")) return "sv-SE";
  return "en-GB";
}

/**
 * `yyyy-MM-dd` in the user's local calendar (for HTML date inputs and API fields).
 * Uses calendar fields only (not locale-dependent formatting).
 */
export function formatLocalDateWire(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 24-hour local time for booking fields. */
export function formatLocalTime24(d: Date): string {
  return new Intl.DateTimeFormat(appLocaleBcp47(), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatWeekdayShort(d: Date): string {
  return new Intl.DateTimeFormat(appLocaleBcp47(), {
    weekday: "short",
  }).format(d);
}

export function formatWeekRangeLabel(
  weekStart: Date,
  weekEndExclusive: Date,
): string {
  const lastDay = new Date(weekEndExclusive);
  lastDay.setDate(lastDay.getDate() - 1);
  const fmt = new Intl.DateTimeFormat(appLocaleBcp47(), {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(weekStart)}–${fmt.format(lastDay)}`;
}
