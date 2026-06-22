import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CaseStatusBadge, VerificationBadge } from "@/components/ui/primitives";
import { VerificationCaseForm, type VerificationCaseValues } from "@/components/verification-case-form";
import { VerificationDocuments, type VerificationDocView } from "@/components/verification-documents";
import { StartVerificationButton } from "@/components/start-verification-button";
import { getT } from "@/lib/i18n/server";

export default async function VerificationPage() {
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.MANAGER;
  const t = await getT();

  const manufacturer = await db.manufacturer.findUnique({
    where: { companyId: company.id },
    include: {
      verificationCases: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { documents: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  const current = manufacturer?.verificationCases[0] ?? null;
  const verification = manufacturer?.verification ?? "UNVERIFIED";
  const isDraft = current?.status === "DRAFT";
  const isLocked = current?.status === "SUBMITTED" || current?.status === "UNDER_REVIEW";

  const values: VerificationCaseValues = {
    legalName: current?.legalName ?? "",
    registrationNumber: current?.registrationNumber ?? "",
    registeredCountry: current?.registeredCountry ?? "",
    registeredAddress: current?.registeredAddress ?? "",
  };
  const documents: VerificationDocView[] = (current?.documents ?? []).map((d) => ({
    id: d.id,
    type: d.type,
    url: d.url,
    fileName: d.fileName,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("verification.title")}</h1>
        <div className="flex items-center gap-2">
          <VerificationBadge status={verification} />
          {current && <CaseStatusBadge status={current.status} />}
        </div>
      </div>

      {current?.status === "REJECTED" && current.reviewNotes && (
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-red-700">{t("verification.rejectedTitle")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{current.reviewNotes}</p>
          </CardContent>
        </Card>
      )}

      {!canManage ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("verification.onlyManager")}</p>
          </CardContent>
        </Card>
      ) : !current || current.status === "APPROVED" || current.status === "REJECTED" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {current?.status === "APPROVED"
                ? t("verification.verifiedTitle")
                : t("verification.getVerified")}
            </CardTitle>
            <p className="mt-1 text-sm text-neutral-500">
              {current?.status === "APPROVED"
                ? t("verification.verifiedNote")
                : t("verification.getVerifiedNote")}
            </p>
          </CardHeader>
          <CardContent>
            <StartVerificationButton
              label={current ? t("verification.startNew") : t("verification.startVerification")}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("verification.businessReg")}</CardTitle>
            </CardHeader>
            <CardContent>
              <VerificationCaseForm values={values} readOnly={!isDraft} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("verification.documents")}</CardTitle>
              {isLocked && (
                <p className="mt-1 text-sm text-neutral-500">{t("verification.lockedNote")}</p>
              )}
            </CardHeader>
            <CardContent>
              <VerificationDocuments documents={documents} editable={isDraft} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
