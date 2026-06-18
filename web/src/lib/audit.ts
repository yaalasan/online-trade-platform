import { headers } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type TxClient = Prisma.TransactionClient | PrismaClient;

export type AuditInput = {
  userId?: string | null;
  companyId?: string | null;
  action: string; // "<resource>.<event>", e.g. "member.role_updated"
  metadata?: Prisma.InputJsonValue;
};

/**
 * Best-effort client IP from proxy headers. Foundation-grade; behind a trusted
 * proxy/WAF in production these are set by us, not the client.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

/**
 * Record a business action. Pass a transaction client (`tx`) to write the audit row
 * in the SAME transaction as the change it describes — so an action and its audit
 * entry commit or roll back together.
 */
export async function logAudit(input: AuditInput, tx: TxClient = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: input.userId ?? null,
      companyId: input.companyId ?? null,
      action: input.action,
      metadata: input.metadata,
      ipAddress: await clientIp(),
    },
  });
}
