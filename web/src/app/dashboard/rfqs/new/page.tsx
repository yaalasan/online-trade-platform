import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { RfqForm } from "@/components/rfq-form";

export default async function NewRfqPage() {
  const ctx = (await getActiveContext())!;
  // Server-side guard mirrors the action check; non-managers never reach the form.
  if (ROLE_RANK[ctx.role] < ROLE_RANK.MANAGER) redirect("/dashboard/rfqs");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/rfqs" className="text-sm text-neutral-500 hover:text-brand">
          ← Back to RFQs
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New RFQ</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request details</CardTitle>
        </CardHeader>
        <CardContent>
          <RfqForm />
        </CardContent>
      </Card>
    </div>
  );
}
