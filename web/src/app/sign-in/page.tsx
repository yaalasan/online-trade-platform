import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n/server";

export default async function SignInPage() {
  const t = await getT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-xl font-semibold">{t("auth.signInTitle")}</h1>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="text-sm text-neutral-500">
        {t("auth.toSignUpPrompt")}{" "}
        <Link href="/sign-up" className="text-brand hover:underline">
          {t("auth.toSignUp")}
        </Link>
      </p>
    </main>
  );
}
