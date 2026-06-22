"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, localeNames, locales } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

/**
 * EN / 中文 / РУ toggle mirroring the buyer site. Writes the `lang` cookie and
 * refreshes the route so server components re-render in the new locale.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(next: string) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center overflow-hidden rounded-md border border-neutral-200 text-xs ${pending ? "opacity-60" : ""} ${className}`}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => select(l)}
          aria-pressed={l === locale}
          className={`px-2 py-1 transition-colors ${
            l === locale
              ? "bg-brand text-white"
              : "bg-white text-neutral-600 hover:text-brand"
          }`}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  );
}
