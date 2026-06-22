import { redirect } from "next/navigation";
import type { VerificationCaseStatus } from "@prisma/client";
import { getPlatformUser } from "@/lib/auth/platform";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CaseStatusBadge,
  Label,
  Select,
} from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { KybReviewControls } from "@/components/kyb-review-controls";
import { getT } from "@/lib/i18n/server";

const PAGE_SIZE = 20;
const STATUS_VALUES: VerificationCaseStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];

type SearchParams = Promise<{ status?: string; page?: string }>;

export default async function KybPage({ searchParams }: { searchParams: SearchParams }) {
  // Fastflow ADMIN only.
  const me = await getPlatformUser();
  if (!me || me.platformRole !== "ADMIN") redirect("/dashboard");
  const t = await getT();
  const sp = await searchParams;

  // Default view focuses on what needs action.
  const status = STATUS_VALUES.includes(sp.status as VerificationCaseStatus)
    ? (sp.status as VerificationCaseStatus)
    : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = status ? { status } : { status: { in: ["SUBMITTED", "UNDER_REVIEW"] as VerificationCaseStatus[] } };

  const [total, cases] = await Promise.all([
    db.verificationCase.count({ where }),
    db.verificationCase.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        documents: { orderBy: { createdAt: "asc" } },
        manufacturer: { select: { country: true, company: { select: { name: true } } } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/kyb?${qs}` : "/dashboard/kyb";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("kyb.title")}</h1>
        <span className="text-sm text-neutral-500">{t("kyb.inView", { count: total })}</span>
      </div>

      <Card>
        <CardContent>
          <form method="get" className="flex items-end gap-3">
            <div>
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select id="status" name="status" defaultValue={status} className="w-48">
                <option value="">{t("kyb.awaitingAction")}</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.case.${s}`)}
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

      {cases.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("kyb.nothingToReview")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {cases.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{c.manufacturer.company.name}</CardTitle>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {c.legalName ?? "—"}
                      {c.registrationNumber ? ` · ${c.registrationNumber}` : ""}
                      {c.registeredCountry || c.manufacturer.country
                        ? ` · ${c.registeredCountry ?? c.manufacturer.country}`
                        : ""}
                      {c.submittedAt
                        ? ` · ${t("kyb.submittedOn", { date: c.submittedAt.toLocaleDateString() })}`
                        : ""}
                    </p>
                  </div>
                  <CaseStatusBadge status={c.status} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.registeredAddress && (
                    <p className="text-sm text-neutral-700">{c.registeredAddress}</p>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-400">{t("verification.documents")}</p>
                    {c.documents.length === 0 ? (
                      <p className="text-sm text-neutral-500">{t("kyb.noneAttached")}</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm">
                        {c.documents.map((d) => (
                          <li key={d.id}>
                            <span className="text-neutral-500">{d.type.replace(/_/g, " ")}:</span>{" "}
                            <a href={d.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                              {d.fileName ?? t("common.view")}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <KybReviewControls id={c.id} reviewNotes={c.reviewNotes} />
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} makeHref={makeHref} />
        </>
      )}
    </div>
  );
}
