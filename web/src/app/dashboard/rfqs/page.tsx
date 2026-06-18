import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, RfqStatusBadge } from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";

export default async function RfqsPage() {
  // Layout already guarantees an active context.
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.MANAGER;

  const rfqs = await db.rfq.findMany({
    where: { companyId: company.id },
    orderBy: [{ createdAt: "desc" }],
    include: { createdBy: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RFQs</h1>
        {canManage && (
          <Link href="/dashboard/rfqs/new" className={buttonVariants()}>
            New RFQ
          </Link>
        )}
      </div>

      {rfqs.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">
              No RFQs yet.{" "}
              {canManage
                ? "Create one to start sourcing."
                : "Ask a manager or owner to create one."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-neutral-100 p-0">
            {rfqs.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/rfqs/${r.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.quantity.toLocaleString()} {r.unit}
                    {r.category ? ` · ${r.category}` : ""} · raised by{" "}
                    {r.createdBy
                      ? r.createdBy.firstName ?? r.createdBy.email
                      : "former member"}{" "}
                    · {r.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <RfqStatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
