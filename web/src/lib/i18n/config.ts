// Locale configuration for the supplier portal. Cookie-based (no URL locale
// segment): the buyer Flask site uses the same EN / 中文 / РУ switcher UX, so we
// mirror it here. The selected locale is persisted in a `lang` cookie and read
// on the server in the root layout.

export const locales = ["en", "zh", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Cookie name shared with the Flask site convention.
export const LOCALE_COOKIE = "lang";

// Labels shown in the language switcher, matching the buyer site.
export const localeNames: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
  ru: "РУ",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
