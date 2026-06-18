import { getActiveContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { UpdateCompanyForm } from "@/components/update-company-form";

export default async function SettingsPage() {
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canEdit = hasPermission(role, "company:update");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
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
