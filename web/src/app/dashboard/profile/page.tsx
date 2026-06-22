import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, VerificationBadge } from "@/components/ui/primitives";
import {
  ManufacturerProfileForm,
  type ManufacturerProfileValues,
} from "@/components/manufacturer-profile-form";
import { CategorySelector } from "@/components/category-selector";
import { CertificationManager, type CertificationView } from "@/components/certification-manager";
import { MediaManager, type MediaView } from "@/components/media-manager";
import { getT } from "@/lib/i18n/server";

export default async function ProfilePage() {
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.MANAGER;
  const t = await getT();

  const [manufacturer, categories] = await Promise.all([
    db.manufacturer.findUnique({
      where: { companyId: company.id },
      include: {
        categories: { select: { categoryId: true } },
        certifications: { orderBy: { createdAt: "desc" } },
        media: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const values: ManufacturerProfileValues = {
    factoryName: manufacturer?.factoryName ?? "",
    description: manufacturer?.description ?? "",
    yearEstablished: manufacturer?.yearEstablished?.toString() ?? "",
    employeeCount: manufacturer?.employeeCount?.toString() ?? "",
    annualOutput: manufacturer?.annualOutput ?? "",
    productionCapacity: manufacturer?.productionCapacity ?? "",
    city: manufacturer?.city ?? "",
    province: manufacturer?.province ?? "",
    country: manufacturer?.country ?? "",
    address: manufacturer?.address ?? "",
  };

  const selectedCategoryIds = manufacturer?.categories.map((c) => c.categoryId) ?? [];

  const certifications: CertificationView[] = (manufacturer?.certifications ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    issuer: c.issuer,
    certificateNo: c.certificateNo,
    issuedAt: c.issuedAt ? c.issuedAt.toLocaleDateString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toLocaleDateString() : null,
    documentUrl: c.documentUrl,
  }));

  const media: MediaView[] = (manufacturer?.media ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    url: m.url,
    fileName: m.fileName,
    contentType: m.contentType,
    caption: m.caption,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>
        <VerificationBadge status={manufacturer?.verification ?? "UNVERIFIED"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.factoryInfo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ManufacturerProfileForm values={values} readOnly={!canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.categories")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategorySelector categories={categories} selectedIds={selectedCategoryIds} readOnly={!canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.certifications")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CertificationManager certifications={certifications} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.photosDocs")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaManager media={media} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
