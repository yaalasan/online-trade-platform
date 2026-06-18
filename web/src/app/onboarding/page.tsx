import { redirect } from "next/navigation";
import { ensureUserSynced, getActiveContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CreateCompanyForm } from "@/components/create-company-form";

export default async function OnboardingPage() {
  await ensureUserSynced();
  const ctx = await getActiveContext();
  if (ctx) redirect("/dashboard"); // already has a company

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>Create your company</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">
            You&apos;ll be the owner. You can invite teammates and create more companies later.
          </p>
        </CardHeader>
        <CardContent>
          <CreateCompanyForm />
        </CardContent>
      </Card>
    </main>
  );
}
