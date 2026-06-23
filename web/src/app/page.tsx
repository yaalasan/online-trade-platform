import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

/**
 * Portal landing. This app is the supplier/manufacturer + staff workspace — buyers
 * use the public Flask site. Signed-in users go straight to the dashboard.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const t = await getT();
  const mainSite = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "http://localhost:5000";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">
        {t("landing.title")} <span className="text-brand">{t("landing.titleAccent")}</span>
      </h1>
      <p className="max-w-xl text-neutral-600">{t("landing.blurb")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/sign-up" className={buttonVariants()}>
          {t("landing.listCompany")}
        </Link>
        <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
          {t("landing.signIn")}
        </Link>
        <a href={mainSite} className={buttonVariants({ variant: "outline" })}>
          {t("landing.backToMain")}
        </a>
      </div>
    </main>
  );
}
