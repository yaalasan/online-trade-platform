import { getActiveContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { getT } from "@/lib/i18n/server";

export default async function OverviewPage() {
  // Layout already guarantees an active context; non-null assertion is safe here.
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const t = await getT();

  const memberCount = await db.membership.count({ where: { companyId: company.id } });

  // Audit is gated: only roles with audit:read see it.
  const canReadAudit = hasPermission(role, "audit:read");
  const audit = canReadAudit
    ? await db.auditLog.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-neutral-500">
          {company.type} · {company.country ?? "—"} · {t("overview.youAre", { role: t(`roles.${role}`) })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("overview.members")}</p>
            <p className="text-2xl font-semibold">{memberCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("overview.yourRole")}</p>
            <p className="text-2xl font-semibold">{t(`roles.${role}`)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("overview.type")}</p>
            <p className="text-2xl font-semibold">{company.type}</p>
          </CardContent>
        </Card>
      </div>

      {canReadAudit && (
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.length === 0 && <p className="text-sm text-neutral-500">{t("overview.noActivity")}</p>}
            {audit.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.action}</span>
                <span className="text-neutral-500">
                  {a.user ? `${a.user.firstName ?? a.user.email}` : t("overview.system")} ·{" "}
                  {a.createdAt.toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
