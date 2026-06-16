import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, InquiryStatusBadge } from "@/components/ui/primitives";
import { InquiryForm } from "@/components/inquiry-form";

function targetLabel(i: {
  kind: string;
  targetManufacturer: { company: { name: string } } | null;
  targetProduct: { name: string } | null;
  rfq: { title: string } | null;
}): string {
  if (i.targetManufacturer) return `Supplier: ${i.targetManufacturer.company.name}`;
  if (i.targetProduct) return `Product: ${i.targetProduct.name}`;
  if (i.rfq) return `RFQ: ${i.rfq.title}`;
  return "General inquiry";
}

export default async function InquiriesPage() {
  const ctx = (await getActiveContext())!;

  const inquiries = await db.inquiry.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { createdAt: "desc" },
    include: {
      targetManufacturer: { select: { company: { select: { name: true } } } },
      targetProduct: { select: { name: true } },
      rfq: { select: { title: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inquiries</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ask SinoSource for an introduction</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">
            Tell us what you need and we&apos;ll connect you with the right counterpart.
          </p>
        </CardHeader>
        <CardContent>
          <InquiryForm kind="GENERAL" label="New inquiry" />
        </CardContent>
      </Card>

      {inquiries.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">
              No inquiries yet. Browse{" "}
              <Link href="/dashboard/suppliers" className="text-brand hover:underline">
                suppliers
              </Link>{" "}
              or the{" "}
              <Link href="/dashboard/catalog" className="text-brand hover:underline">
                catalog
              </Link>{" "}
              and request an introduction.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-neutral-100 p-0">
            {inquiries.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{targetLabel(i)}</p>
                  <p className="truncate text-xs text-neutral-500">{i.message}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">{i.createdAt.toLocaleString()}</p>
                </div>
                <InquiryStatusBadge status={i.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
