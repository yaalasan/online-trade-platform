"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { type Dictionary, translate } from "./dictionaries";

type I18nValue = { locale: Locale; dict: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

/** Provides the active locale + dictionary to client components. Mounted once
 * in the root layout with values resolved on the server. */
export function I18nProvider({
  locale,
  dict,
  children,
}: I18nValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

/** Translator for client components: `const t = useT(); t("common.save")`. */
export function useT() {
  const { dict } = useI18n();
  return (key: string, vars?: Record<string, string | number>) =>
    translate(dict, key, vars);
}
