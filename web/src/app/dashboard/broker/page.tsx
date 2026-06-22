import { redirect } from "next/navigation";
import type { InquiryStatus } from "@prisma/client";
import { getPlatformUser } from "@/lib/auth/platform";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InquiryStatusBadge,
  Label,
  Select,
} from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { InquiryBrokerControls } from "@/components/inquiry-broker-controls";
import { getT } from "@/lib/i18n/server";

const PAGE_SIZE = 20;
const STATUS_VALUES: InquiryStatus[] = ["NEW", "IN_REVIEW", "INTRODUCED", "CLOSED"];

type SearchParams = Promise<{ status?: string; page?: string }>;

function personName(u: { firstName: string | null; lastName: string | null; email: string } | null): string | null {
  if (!u) return null;
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email;
}

/** One label/value row in a public lead's contact block; hidden when empty. */
function ContactRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-400">{label}:</dt>
      <dd className="font-medium text-neutral-800">{value}</dd>
    </div>
  );
}

export default async function BrokerPage({ searchParams }: { searchParams: SearchParams }) {
  // Fastflow staff only. (Dashboard layout already requires an active company.)
  const staff = await getPlatformUser();
  if (!staff) redirect("/dashboard");
  const t = await getT();
  const sp = await searchParams;

  const status = STATUS_VALUES.includes(sp.status as InquiryStatus) ? (sp.status as InquiryStatus) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = status ? { status } : {};

  const [total, inquiries] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        targetManufacturer: { select: { id: true, company: { select: { name: true } } } },
        targetProduct: { select: { id: true, name: true } },
        rfq: { select: { id: true, title: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/broker?${qs}` : "/dashboard/broker";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("broker.title")}</h1>
        <span className="text-sm text-neutral-500">{t("broker.total", { count: total })}</span>
      </div>

      <Card>
        <CardContent>
          <form method="get" className="flex items-end gap-3">
            <div>
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select id="status" name="status" defaultValue={status} className="w-44">
                <option value="">{t("common.all")}</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.inquiry.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              {t("broker.filter")}
            </button>
          </form>
        </CardContent>
      </Card>

      {inquiries.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("broker.noneInView")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {inquiries.map((i) => {
              const target = i.targetManufacturer
                ? t("inquiries.supplierPrefix", { name: i.targetManufacturer.company.name })
                : i.targetProduct
                  ? t("inquiries.productPrefix", { name: i.targetProduct.name })
                  : i.rfq
                    ? t("inquiries.rfqPrefix", { title: i.rfq.title })
                    : t("inquiries.general");
              // Public leads have no requesting company; the buyer self-reports.
              const isPublic = !i.company;
              const heading = i.company?.name ?? i.contactCompany ?? i.contactName ?? t("broker.publicLead");
              const by = personName(i.createdBy) ?? i.contactEmail ?? t("broker.unknown");
              return (
                <Card key={i.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {heading}
                        {isPublic && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                            {t("broker.publicLead")}
                          </span>
                        )}
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {i.kind} · {target} · {t("broker.by", { name: by })} ·{" "}
                        {i.createdAt.toLocaleString()}
                      </p>
                    </div>
                    <InquiryStatusBadge status={i.status} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap text-sm text-neutral-800">{i.message}</p>
                    {isPublic && (
                      <dl className="grid gap-x-6 gap-y-1 rounded-md bg-neutral-50 p-3 text-xs text-neutral-700 sm:grid-cols-2">
                        <ContactRow label={t("common.name")} value={i.contactName} />
                        <ContactRow label={t("common.email")} value={i.contactEmail} />
                        <ContactRow label={t("broker.phone")} value={i.contactPhone} />
                        <ContactRow label={t("broker.company")} value={i.contactCompany} />
                        <ContactRow label={t("broker.country")} value={i.contactCountry} />
                        <ContactRow label={t("broker.quantity")} value={i.quantity} />
                      </dl>
                    )}
                    <InquiryBrokerControls
                      id={i.id}
                      status={i.status}
                      brokerNotes={i.brokerNotes}
                      assignedToName={personName(i.assignedTo)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} makeHref={makeHref} />
        </>
      )}
    </div>
  );
}
