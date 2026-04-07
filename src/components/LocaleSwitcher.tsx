import { useTranslation } from "react-i18next";
import { persistUiLanguage, type UiLang } from "../i18n/i18n";

export function LocaleSwitcher() {
  const { t, i18n } = useTranslation();
  const current: UiLang = (
    i18n.resolvedLanguage ?? i18n.language
  ).startsWith("sv")
    ? "sv"
    : "en";

  const setLang = (lng: UiLang) => {
    void i18n.changeLanguage(lng);
    persistUiLanguage(lng);
  };

  const opt =
    "rounded px-1 py-0.5 text-[11px] font-medium tracking-wide transition-colors focus-visible:outline-te-accent focus-visible:outline-2 focus-visible:outline-offset-1";

  return (
    <div
      className="text-te-muted/75 inline-flex items-center gap-0.5"
      role="group"
      aria-label={t("app.language")}
    >
      <button
        type="button"
        lang="en"
        title={t("app.langEnglish")}
        className={`${opt} ${
          current === "en"
            ? "text-te-text"
            : "opacity-65 hover:text-te-text hover:opacity-100"
        }`}
        aria-pressed={current === "en"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <span aria-hidden className="pointer-events-none select-none opacity-40">
        /
      </span>
      <button
        type="button"
        lang="sv"
        title={t("app.langSwedish")}
        className={`${opt} ${
          current === "sv"
            ? "text-te-text"
            : "opacity-65 hover:text-te-text hover:opacity-100"
        }`}
        aria-pressed={current === "sv"}
        onClick={() => setLang("sv")}
      >
        SV
      </button>
    </div>
  );
}
