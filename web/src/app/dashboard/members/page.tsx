import { getActiveContext } from "@/lib/auth/session";
import { hasPermission, outranks } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, RoleBadge } from "@/components/ui/primitives";
import {
  InviteMemberForm,
  MemberRoleControl,
  RemoveMemberButton,
} from "@/components/member-management";
import { getT } from "@/lib/i18n/server";

export default async function MembersPage() {
  const ctx = (await getActiveContext())!;
  const { company, role: myRole, user } = ctx;
  const t = await getT();

  const canInvite = hasPermission(myRole, "member:invite");
  const canUpdateRole = hasPermission(myRole, "member:update_role");
  const canRemove = hasPermission(myRole, "member:remove");

  const members = await db.membership.findMany({
    where: { companyId: company.id },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("members.title")}</h1>

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle>{t("members.addMember")}</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">{t("members.addMemberNote")}</p>
          </CardHeader>
          <CardContent>
            <InviteMemberForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-y divide-neutral-100 p-0">
          {members.map((m) => {
            const isSelf = m.userId === user.id;
            // Server enforces this regardless; we only decide whether to SHOW controls.
            const manageable = !isSelf && outranks(myRole, m.role);
            return (
              <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {m.user.firstName || m.user.lastName
                      ? `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim()
                      : m.user.email}
                    {isSelf && <span className="ml-2 text-xs text-neutral-400">{t("members.you")}</span>}
                  </p>
                  <p className="text-xs text-neutral-500">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canUpdateRole && manageable ? (
                    <MemberRoleControl membershipId={m.id} role={m.role} />
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                  {canRemove && manageable && <RemoveMemberButton membershipId={m.id} />}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
