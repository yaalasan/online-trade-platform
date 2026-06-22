import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, InquiryStatusBadge } from "@/components/ui/primitives";
import { InquiryForm } from "@/components/inquiry-form";
import { getT } from "@/lib/i18n/server";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function targetLabel(
  i: {
    kind: string;
    targetManufacturer: { company: { name: string } } | null;
    targetProduct: { name: string } | null;
    rfq: { title: string } | null;
  },
  t: Translator,
): string {
  if (i.targetManufacturer)
    return t("inquiries.supplierPrefix", { name: i.targetManufacturer.company.name });
  if (i.targetProduct) return t("inquiries.productPrefix", { name: i.targetProduct.name });
  if (i.rfq) return t("inquiries.rfqPrefix", { title: i.rfq.title });
  return t("inquiries.general");
}

export default async function InquiriesPage() {
  const ctx = (await getActiveContext())!;
  const t = await getT();

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
      <h1 className="text-2xl font-semibold">{t("inquiries.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("inquiries.askIntro")}</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">{t("inquiries.askIntroNote")}</p>
        </CardHeader>
        <CardContent>
          <InquiryForm kind="GENERAL" label={t("inquiries.newInquiry")} />
        </CardContent>
      </Card>

      {inquiries.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">
              {t("inquiries.noneA")}
              <Link href="/dashboard/suppliers" className="text-brand hover:underline">
                {t("inquiries.linkSuppliers")}
              </Link>
              {t("inquiries.noneMid")}
              <Link href="/dashboard/catalog" className="text-brand hover:underline">
                {t("inquiries.linkCatalog")}
              </Link>
              {t("inquiries.noneB")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-neutral-100 p-0">
            {inquiries.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{targetLabel(i, t)}</p>
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
