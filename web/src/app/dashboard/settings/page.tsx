import { getActiveContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { UpdateCompanyForm } from "@/components/update-company-form";
import { getT } from "@/lib/i18n/server";

export default async function SettingsPage() {
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canEdit = hasPermission(role, "company:update");
  const t = await getT();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.companyProfile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateCompanyForm
            readOnly={!canEdit}
            company={{
              name: company.name,
              type: company.type,
              country: company.country,
              website: company.website,
              description: company.description,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
