import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, RfqStatusBadge } from "@/components/ui/primitives";
import { RfqForm, type RfqFormValues } from "@/components/rfq-form";
import { DeleteRfqButton } from "@/components/delete-rfq-button";

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.MANAGER;

  // Scope is enforced in the query: an RFQ from another company is simply not found.
  const rfq = await db.rfq.findFirst({
    where: { id, companyId: company.id },
    include: { createdBy: true },
  });
  if (!rfq) notFound();

  const defaults: RfqFormValues = {
    title: rfq.title,
    description: rfq.description,
    category: rfq.category ?? "",
    quantity: String(rfq.quantity),
    unit: rfq.unit,
    targetPrice: rfq.targetPrice ? rfq.targetPrice.toString() : "",
    currency: rfq.currency ?? "",
    incoterm: rfq.incoterm ?? "",
    destinationCountry: rfq.destinationCountry ?? "",
    needBy: rfq.needBy ? rfq.needBy.toISOString().slice(0, 10) : "",
    status: rfq.status,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/rfqs" className="text-sm text-neutral-500 hover:text-brand">
            ← Back to RFQs
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{rfq.title}</h1>
            <RfqStatusBadge status={rfq.status} />
          </div>
          <p className="text-sm text-neutral-500">
            Raised by{" "}
            {rfq.createdBy ? rfq.createdBy.firstName ?? rfq.createdBy.email : "former member"} ·{" "}
            {rfq.createdAt.toLocaleString()}
          </p>
        </div>
        {canManage && <DeleteRfqButton rfqId={rfq.id} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Quantity" value={`${rfq.quantity.toLocaleString()} ${rfq.unit}`} />
          <Detail label="Category" value={rfq.category ?? "—"} />
          <Detail
            label="Target price / unit"
            value={
              rfq.targetPrice
                ? `${rfq.targetPrice.toString()}${rfq.currency ? ` ${rfq.currency}` : ""}`
                : "—"
            }
          />
          <Detail label="Incoterm" value={rfq.incoterm ?? "—"} />
          <Detail label="Destination" value={rfq.destinationCountry ?? "—"} />
          <Detail
            label="Need by"
            value={rfq.needBy ? rfq.needBy.toLocaleDateString() : "—"}
          />
          <div className="sm:col-span-2">
            <Detail label="Description" value={rfq.description} />
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Edit RFQ</CardTitle>
          </CardHeader>
          <CardContent>
            <RfqForm rfqId={rfq.id} defaults={defaults} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="whitespace-pre-wrap text-neutral-800">{value}</p>
    </div>
  );
}
