import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/translation.json";
import sv from "./locales/sv/translation.json";

export const I18N_LANG_STORAGE_KEY = "timeedit-i18n-lang";

export type UiLang = "en" | "sv";

function readStoredLanguage(): UiLang | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(I18N_LANG_STORAGE_KEY);
  if (v === "en" || v === "sv") return v;
  return null;
}

function initialLanguage(): string {
  const stored = readStoredLanguage();
  if (stored) return stored;
  if (
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("sv")
  ) {
    return "sv";
  }
  return "en";
}

export function persistUiLanguage(lng: UiLang) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(I18N_LANG_STORAGE_KEY, lng);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sv: { translation: sv },
  },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

function syncHtmlLang(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
}

i18n.on("languageChanged", syncHtmlLang);
syncHtmlLang(i18n.language);

export default i18n;
