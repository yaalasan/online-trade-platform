"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { requireActiveContext } from "@/lib/auth/rbac";
import { requirePlatformStaff } from "@/lib/auth/platform";
import { createInquirySchema, updateInquirySchema, idSchema } from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";

/**
 * Raise an introduction request. Any active member may inquire — it is a low-stakes
 * request handled by Fastflow. Scope (requesting company) is server-derived.
 * Targets reference public contacts; an `rfqId` must belong to the requester.
 */
export async function createInquiry(formData: FormData): Promise<ActionResult<{ inquiryId: string }>> {
  return run(async () => {
    const ctx = await requireActiveContext();

    const parsed = createInquirySchema.safeParse({
      kind: formData.get("kind") ?? "GENERAL",
      message: formData.get("message"),
      targetManufacturerId: formData.get("targetManufacturerId") ?? "",
      targetProductId: formData.get("targetProductId") ?? "",
      rfqId: formData.get("rfqId") ?? "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const i = parsed.data;

    const targetManufacturerId = i.targetManufacturerId || null;
    const targetProductId = i.targetProductId || null;
    const rfqId = i.rfqId || null;

    // Validate any supplied targets so we never store dangling references.
    if (targetManufacturerId) {
      const exists = await db.manufacturer.findUnique({
        where: { id: targetManufacturerId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundError("That supplier no longer exists.");
    }
    if (targetProductId) {
      const exists = await db.product.findFirst({
        where: { id: targetProductId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!exists) throw new NotFoundError("That product is not available.");
    }
    if (rfqId) {
      const owned = await db.rfq.findFirst({
        where: { id: rfqId, companyId: ctx.company.id },
        select: { id: true },
      });
      if (!owned) throw new ValidationError("You can only attach your own RFQ.");
    }

    const inquiry = await db.$transaction(async (tx) => {
      const created = await tx.inquiry.create({
        data: {
          companyId: ctx.company.id,
          createdByUserId: ctx.user.id,
          kind: i.kind,
          message: i.message,
          targetManufacturerId,
          targetProductId,
          rfqId,
        },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "inquiry.created",
          metadata: { inquiryId: created.id, kind: created.kind },
        },
        tx,
      );
      return created;
    });

    revalidatePath("/dashboard/inquiries");
    revalidatePath("/dashboard/broker");
    return { inquiryId: inquiry.id };
  });
}

/** Broker: update an inquiry's status and internal notes. Fastflow staff only. */
export async function updateInquiry(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const staff = await requirePlatformStaff();

    const parsed = updateInquirySchema.safeParse({
      id: formData.get("id"),
      status: formData.get("status"),
      brokerNotes: formData.get("brokerNotes") ?? "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { id, status, brokerNotes } = parsed.data;

    const existing = await db.inquiry.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });
    if (!existing) throw new NotFoundError("Inquiry not found.");

    await db.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id: existing.id },
        data: { status, brokerNotes: brokerNotes || null },
      });
      await logAudit(
        {
          userId: staff.id,
          companyId: existing.companyId, // the requesting company this concerns
          action: "inquiry.updated",
          metadata: { inquiryId: existing.id, statusFrom: existing.status, statusTo: status },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/broker");
    return undefined;
  });
}

/** Broker: claim an inquiry (assign it to the acting staff member). */
export async function assignInquiryToMe(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const staff = await requirePlatformStaff();

    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    const existing = await db.inquiry.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, companyId: true },
    });
    if (!existing) throw new NotFoundError("Inquiry not found.");

    await db.$transaction(async (tx) => {
      await tx.inquiry.update({ where: { id: existing.id }, data: { assignedToUserId: staff.id } });
      await logAudit(
        {
          userId: staff.id,
          companyId: existing.companyId,
          action: "inquiry.assigned",
          metadata: { inquiryId: existing.id, assignedTo: staff.id },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/broker");
    return undefined;
  });
}
