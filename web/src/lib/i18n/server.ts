import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./config";
import { dictionaries, translate } from "./dictionaries";

/** Read the active locale from the `lang` cookie (defaults to English). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary(locale?: Locale) {
  const l = locale ?? (await getLocale());
  return dictionaries[l];
}

/**
 * Translator for server components: `const t = await getT(); t("nav.overview")`.
 */
export async function getT(locale?: Locale) {
  const dict = await getDictionary(locale);
  return (key: string, vars?: Record<string, string | number>) =>
    translate(dict, key, vars);
}
