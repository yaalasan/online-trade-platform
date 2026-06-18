"use server";

import { revalidatePath } from "next/cache";
import type { MembershipRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireActiveContext } from "@/lib/auth/rbac";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { ROLE_RANK } from "@/lib/auth/permissions";
import {
  verificationCaseSchema,
  verificationDocTypeEnum,
  reviewCaseSchema,
  idSchema,
} from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";

const MAX_DOC_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOC_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function assertCanManage(role: MembershipRole): void {
  if (ROLE_RANK[role] < ROLE_RANK.MANAGER) {
    throw new AuthorizationError("Your role cannot manage verification.");
  }
}

async function ensureManufacturerId(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const m = await tx.manufacturer.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
    select: { id: true },
  });
  return m.id;
}

/**
 * Return the editable (DRAFT) case for the manufacturer, creating one if none is
 * open. Throws if an application is already submitted / under review (locked).
 */
async function getEditableCaseId(tx: Prisma.TransactionClient, manufacturerId: string): Promise<string> {
  const open = await tx.verificationCase.findFirst({
    where: { manufacturerId, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (open) {
    if (open.status !== "DRAFT") throw new ValidationError("Your application is already under review.");
    return open.id;
  }
  const created = await tx.verificationCase.create({ data: { manufacturerId } });
  return created.id;
}

/** Open a fresh draft application (first-time or re-apply after a terminal case). */
export async function startNewVerificationCase(): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    await db.$transaction(async (tx) => {
      const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
      const caseId = await getEditableCaseId(tx, manufacturerId); // reuses an open draft, else creates one
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "kyb.case_started",
          metadata: { caseId },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/verification");
  });
}

/** Save business-registration info on the active company's draft KYB case. */
export async function saveVerificationCase(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = verificationCaseSchema.safeParse({
      legalName: formData.get("legalName") ?? "",
      registrationNumber: formData.get("registrationNumber") ?? "",
      registeredCountry: formData.get("registeredCountry") ?? "",
      registeredAddress: formData.get("registeredAddress") ?? "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const i = parsed.data;

    await db.$transaction(async (tx) => {
      const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
      const caseId = await getEditableCaseId(tx, manufacturerId);
      await tx.verificationCase.update({
        where: { id: caseId },
        data: {
          legalName: i.legalName || null,
          registrationNumber: i.registrationNumber || null,
          registeredCountry: i.registeredCountry || null,
          registeredAddress: i.registeredAddress || null,
        },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "kyb.case_saved",
          metadata: { caseId },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/verification");
  });
}

/** Attach a document (business license, certificate, …) to the draft case. */
export async function uploadVerificationDocument(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload.");
    if (file.size > MAX_DOC_BYTES) throw new ValidationError("File exceeds the 8 MB limit.");
    if (!ALLOWED_DOC_TYPES.has(file.type)) throw new ValidationError("Only image or PDF files are allowed.");
    const typeParsed = verificationDocTypeEnum.safeParse(formData.get("type") ?? "BUSINESS_LICENSE");
    if (!typeParsed.success) throw new ValidationError("Invalid document type.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put(
      { buffer, fileName: file.name, contentType: file.type },
      { prefix: `kyb/${ctx.company.id}` },
    );
    try {
      await db.$transaction(async (tx) => {
        const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
        const caseId = await getEditableCaseId(tx, manufacturerId);
        const doc = await tx.verificationDocument.create({
          data: {
            caseId,
            type: typeParsed.data,
            url: stored.url,
            storageKey: stored.key,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          },
        });
        await logAudit(
          {
            userId: ctx.user.id,
            companyId: ctx.company.id,
            action: "kyb.document_added",
            metadata: { caseId, documentId: doc.id, type: doc.type },
          },
          tx,
        );
      });
    } catch (e) {
      await storage.remove(stored.key).catch(() => {});
      throw e;
    }

    revalidatePath("/dashboard/verification");
  });
}

/** Remove a document from the active company's draft case. */
export async function deleteVerificationDocument(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    const doc = await db.verificationDocument.findFirst({
      where: {
        id: parsed.data.id,
        case: { manufacturer: { companyId: ctx.company.id }, status: "DRAFT" },
      },
      select: { id: true, storageKey: true, caseId: true },
    });
    if (!doc) throw new NotFoundError("Document not found or the case is locked.");

    await db.$transaction(async (tx) => {
      await tx.verificationDocument.delete({ where: { id: doc.id } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "kyb.document_deleted",
          metadata: { caseId: doc.caseId, documentId: doc.id },
        },
        tx,
      );
    });

    if (doc.storageKey) await storage.remove(doc.storageKey).catch(() => {});
    revalidatePath("/dashboard/verification");
  });
}

/** Submit the draft case for review. Requires at least one document. */
export async function submitVerificationCase(): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    await db.$transaction(async (tx) => {
      const manufacturer = await tx.manufacturer.findUnique({
        where: { companyId: ctx.company.id },
        select: { id: true },
      });
      if (!manufacturer) throw new ValidationError("Complete your profile before submitting.");

      const draft = await tx.verificationCase.findFirst({
        where: { manufacturerId: manufacturer.id, status: "DRAFT" },
        orderBy: { createdAt: "desc" },
        select: { id: true, _count: { select: { documents: true } } },
      });
      if (!draft) throw new ValidationError("There is no draft application to submit.");
      if (draft._count.documents === 0) {
        throw new ValidationError("Attach at least one document (e.g. business license) first.");
      }

      await tx.verificationCase.update({
        where: { id: draft.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), submittedByUserId: ctx.user.id },
      });
      // Reflect "pending review" on the supplier badge.
      await tx.manufacturer.update({
        where: { id: manufacturer.id },
        data: { verification: "PENDING" },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "kyb.case_submitted",
          metadata: { caseId: draft.id },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/verification");
  });
}

/** Admin review: claim, approve, or reject a submitted KYB case. ADMIN only. */
export async function reviewVerificationCase(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const admin = await requirePlatformAdmin();

    const parsed = reviewCaseSchema.safeParse({
      id: formData.get("id"),
      decision: formData.get("decision"),
      reviewNotes: formData.get("reviewNotes") ?? "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { id, decision, reviewNotes } = parsed.data;

    const kase = await db.verificationCase.findUnique({
      where: { id },
      select: { id: true, status: true, manufacturerId: true, manufacturer: { select: { companyId: true } } },
    });
    if (!kase) throw new NotFoundError("Case not found.");
    if (kase.status !== "SUBMITTED" && kase.status !== "UNDER_REVIEW") {
      throw new ValidationError("This case is not awaiting review.");
    }

    // Map the decision to case status + the denormalized manufacturer badge.
    const caseStatus = decision; // UNDER_REVIEW | APPROVED | REJECTED
    const verification =
      decision === "APPROVED" ? "VERIFIED" : decision === "REJECTED" ? "REJECTED" : "PENDING";
    const terminal = decision === "APPROVED" || decision === "REJECTED";

    await db.$transaction(async (tx) => {
      await tx.verificationCase.update({
        where: { id: kase.id },
        data: {
          status: caseStatus,
          reviewedByUserId: admin.id,
          reviewNotes: reviewNotes || null,
          reviewedAt: terminal ? new Date() : null,
        },
      });
      await tx.manufacturer.update({
        where: { id: kase.manufacturerId },
        data: { verification },
      });
      await logAudit(
        {
          userId: admin.id,
          companyId: kase.manufacturer.companyId,
          action: "kyb.reviewed",
          metadata: { caseId: kase.id, decision, verification },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/kyb");
    revalidatePath("/dashboard/verification");
  });
}
