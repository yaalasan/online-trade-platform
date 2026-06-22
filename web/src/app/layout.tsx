import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, ruRU, zhCN } from "@clerk/localizations";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import "./globals.css";

// Localizes Clerk's hosted <SignIn>/<SignUp>/<UserButton> widgets to match the
// portal locale.
const clerkLocalization = { en: enUS, zh: zhCN, ru: ruRU } satisfies Record<
  Locale,
  unknown
>;

export const metadata: Metadata = {
  title: "Fastflow — B2B Sourcing",
  description: "Connect Chinese manufacturers with international buyers.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <ClerkProvider localization={clerkLocalization[locale]}>
      <html lang={locale}>
        <body className="min-h-screen antialiased">
          <I18nProvider locale={locale} dict={dict}>
            {children}
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
