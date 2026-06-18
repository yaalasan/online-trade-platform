"use server";

import { revalidatePath } from "next/cache";
import type { MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireActiveContext } from "@/lib/auth/rbac";
import { ROLE_RANK } from "@/lib/auth/permissions";
import {
  createRfqSchema,
  updateRfqSchema,
  rfqIdSchema,
  type CreateRfqInput,
} from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";

/**
 * RFQs are managed by the operational tier and above (MANAGER, ADMIN, OWNER).
 * MEMBER may view but not mutate — mirroring the read-only stance MEMBER has
 * elsewhere. This reuses the existing role-rank table; it does not change RBAC.
 */
function assertCanManageRfqs(role: MembershipRole): void {
  if (ROLE_RANK[role] < ROLE_RANK.MANAGER) {
    throw new AuthorizationError("Your role cannot manage RFQs.");
  }
}

/** Map a validated input to the Prisma column shape (optionals → null). */
function toRfqData(input: CreateRfqInput) {
  return {
    title: input.title,
    description: input.description,
    category: input.category || null,
    quantity: input.quantity,
    unit: input.unit,
    targetPrice: input.targetPrice ?? null,
    currency: input.currency ?? null,
    incoterm: input.incoterm || null,
    destinationCountry: input.destinationCountry || null,
    needBy: input.needBy ?? null,
    status: input.status,
  };
}

/** Create an RFQ owned by the caller's ACTIVE company. */
export async function createRfq(formData: FormData): Promise<ActionResult<{ rfqId: string }>> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManageRfqs(ctx.role);

    const parsed = createRfqSchema.safeParse(formInput(formData));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const data = toRfqData(parsed.data);

    const rfq = await db.$transaction(async (tx) => {
      const created = await tx.rfq.create({
        data: {
          ...data,
          companyId: ctx.company.id, // scope is server-derived, never from the client
          createdByUserId: ctx.user.id,
        },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "rfq.created",
          metadata: { rfqId: created.id, title: created.title, status: created.status },
        },
        tx,
      );
      return created;
    });

    revalidatePath("/dashboard/rfqs");
    return { rfqId: rfq.id };
  });
}

/** Update an RFQ. Only RFQs belonging to the active company are reachable. */
export async function updateRfq(formData: FormData): Promise<ActionResult<{ rfqId: string }>> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManageRfqs(ctx.role);

    const parsed = updateRfqSchema.safeParse({ ...formInput(formData), id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { id, ...rest } = parsed.data;
    const data = toRfqData(rest);

    // Scope check: the row must belong to the active company (blocks cross-company tampering).
    const existing = await db.rfq.findFirst({
      where: { id, companyId: ctx.company.id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError("RFQ not found in this company.");

    await db.$transaction(async (tx) => {
      await tx.rfq.update({ where: { id: existing.id }, data });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "rfq.updated",
          metadata: {
            rfqId: existing.id,
            title: data.title,
            statusFrom: existing.status,
            statusTo: data.status,
          },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/rfqs");
    revalidatePath(`/dashboard/rfqs/${existing.id}`);
    return { rfqId: existing.id };
  });
}

/** Delete an RFQ owned by the active company. */
export async function deleteRfq(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManageRfqs(ctx.role);

    const parsed = rfqIdSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    const existing = await db.rfq.findFirst({
      where: { id: parsed.data.id, companyId: ctx.company.id },
      select: { id: true, title: true },
    });
    if (!existing) throw new NotFoundError("RFQ not found in this company.");

    await db.$transaction(async (tx) => {
      await tx.rfq.delete({ where: { id: existing.id } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "rfq.deleted",
          metadata: { rfqId: existing.id, title: existing.title },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/rfqs");
  });
}

/** Pull the RFQ fields out of a submitted form into a plain object for zod. */
function formInput(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category") ?? "",
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    targetPrice: formData.get("targetPrice") ?? "",
    currency: formData.get("currency") ?? "",
    incoterm: formData.get("incoterm") ?? "",
    destinationCountry: formData.get("destinationCountry") ?? "",
    needBy: formData.get("needBy") ?? "",
    status: formData.get("status") ?? "OPEN",
  };
}
