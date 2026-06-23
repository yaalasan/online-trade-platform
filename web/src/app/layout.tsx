import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fastflow — B2B Sourcing",
  description: "Connect Chinese manufacturers with international buyers.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
