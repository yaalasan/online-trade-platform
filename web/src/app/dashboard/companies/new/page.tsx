import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureUserSynced, getActiveContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CreateCompanyForm } from "@/components/create-company-form";

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

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-brand">
        ← Back to dashboard
      </Link>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Add a company</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">
            Create another manufacturer or buyer. You&apos;ll be its owner, and it becomes your
            active company so you can add its products and details right away. Switch between
            companies any time from the selector in the header.
          </p>
        </CardHeader>
        <CardContent>
          <CreateCompanyForm />
        </CardContent>
      </Card>
    </div>
  );
}
