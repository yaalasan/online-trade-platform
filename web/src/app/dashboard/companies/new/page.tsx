import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureUserSynced, getActiveContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CreateCompanyForm } from "@/components/create-company-form";
import { getT } from "@/lib/i18n/server";

/**
 * Add another company from inside the dashboard. Same form/action as onboarding,
 * but reachable once you already have a company — the brokered flow where one
 * operator manages many manufacturers. `createCompany` makes you OWNER and sets
 * the new company active, then the form redirects to /dashboard.
 */
export default async function NewCompanyPage() {
  await ensureUserSynced();
  const ctx = await getActiveContext();
  if (!ctx) redirect("/onboarding"); // no company yet → first-run flow
  const t = await getT();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-brand">
        {t("companyNew.backToDashboard")}
      </Link>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>{t("companyNew.addCompany")}</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">{t("companyNew.addCompanyNote")}</p>
        </CardHeader>
        <CardContent>
          <CreateCompanyForm />
        </CardContent>
      </Card>
    </div>
  );
}
