import { SignUp } from "@clerk/nextjs";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n/server";

export default async function SignUpPage() {
  const t = await getT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <h1 className="text-xl font-semibold">{t("auth.signUpTitle")}</h1>
      <SignUp />
    </main>
  );
}
