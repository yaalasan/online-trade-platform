"use server";

import { revalidatePath } from "next/cache";
import type { MembershipRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { requireActiveContext } from "@/lib/auth/rbac";
import { ROLE_RANK } from "@/lib/auth/permissions";
import {
  manufacturerProfileSchema,
  setCategoriesSchema,
  certificationSchema,
  mediaMetaSchema,
  idSchema,
} from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/**
 * Supplier-profile edits require the operational tier or above (MANAGER+),
 * reusing the existing role-rank table. MEMBER can view but not mutate. Scope is
 * always the caller's ACTIVE company — derived server-side, never from args.
 */
function assertCanManage(role: MembershipRole): void {
  if (ROLE_RANK[role] < ROLE_RANK.MANAGER) {
    throw new AuthorizationError("Your role cannot edit the company profile.");
  }
}

/** Lazily create the 1:1 Manufacturer row for the active company and return its id. */
async function ensureManufacturerId(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const m = await tx.manufacturer.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
    select: { id: true },
  });
  return m.id;
}

/** Create or update the active company's manufacturer/factory profile. */
export async function updateManufacturerProfile(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = manufacturerProfileSchema.safeParse({
      factoryName: formData.get("factoryName") ?? "",
      description: formData.get("description") ?? "",
      yearEstablished: formData.get("yearEstablished") ?? "",
      employeeCount: formData.get("employeeCount") ?? "",
      annualOutput: formData.get("annualOutput") ?? "",
      productionCapacity: formData.get("productionCapacity") ?? "",
      city: formData.get("city") ?? "",
      province: formData.get("province") ?? "",
      country: formData.get("country") ?? "",
      address: formData.get("address") ?? "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const i = parsed.data;

    const data = {
      factoryName: i.factoryName || null,
      description: i.description || null,
      yearEstablished: i.yearEstablished ?? null,
      employeeCount: i.employeeCount ?? null,
      annualOutput: i.annualOutput || null,
      productionCapacity: i.productionCapacity || null,
      city: i.city || null,
      province: i.province || null,
      country: i.country || null,
      address: i.address || null,
    };

    await db.$transaction(async (tx) => {
      const existing = await tx.manufacturer.findUnique({
        where: { companyId: ctx.company.id },
        select: { id: true },
      });
      await tx.manufacturer.upsert({
        where: { companyId: ctx.company.id },
        create: { companyId: ctx.company.id, ...data },
        update: data,
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: existing ? "manufacturer.updated" : "manufacturer.created",
          metadata: { factoryName: data.factoryName },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/profile");
  });
}

/** Replace the manufacturer's category tags with the supplied set. */
export async function setManufacturerCategories(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = setCategoriesSchema.safeParse({
      categoryIds: formData.getAll("categoryIds").map(String),
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    await db.$transaction(async (tx) => {
      const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
      // Keep only ids that actually exist in the taxonomy (ignore tampered values).
      const valid = await tx.category.findMany({
        where: { id: { in: parsed.data.categoryIds } },
        select: { id: true },
      });
      await tx.manufacturerCategory.deleteMany({ where: { manufacturerId } });
      if (valid.length > 0) {
        await tx.manufacturerCategory.createMany({
          data: valid.map((c) => ({ manufacturerId, categoryId: c.id })),
          skipDuplicates: true,
        });
      }
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "manufacturer.categories_set",
          metadata: { count: valid.length },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/profile");
  });
}

/** Add a certification to the active company's manufacturer profile. */
export async function addCertification(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = certificationSchema.safeParse({
      name: formData.get("name"),
      issuer: formData.get("issuer") ?? "",
      certificateNo: formData.get("certificateNo") ?? "",
      issuedAt: formData.get("issuedAt") ?? "",
      expiresAt: formData.get("expiresAt") ?? "",
      documentUrl: formData.get("documentUrl") ?? "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const i = parsed.data;

    await db.$transaction(async (tx) => {
      const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
      const cert = await tx.certification.create({
        data: {
          manufacturerId,
          name: i.name,
          issuer: i.issuer || null,
          certificateNo: i.certificateNo || null,
          issuedAt: i.issuedAt ?? null,
          expiresAt: i.expiresAt ?? null,
          documentUrl: i.documentUrl || null,
        },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "certification.added",
          metadata: { certificationId: cert.id, name: cert.name },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/profile");
  });
}

/** Delete a certification owned by the active company. */
export async function deleteCertification(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    // Relation filter scopes the lookup to the active company (cross-company safe).
    const cert = await db.certification.findFirst({
      where: { id: parsed.data.id, manufacturer: { companyId: ctx.company.id } },
      select: { id: true, name: true },
    });
    if (!cert) throw new NotFoundError("Certification not found.");

    await db.$transaction(async (tx) => {
      await tx.certification.delete({ where: { id: cert.id } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "certification.deleted",
          metadata: { certificationId: cert.id, name: cert.name },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/profile");
  });
}

/** Upload a media asset (factory photo, logo, scanned certificate). */
export async function uploadMedia(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError("Choose a file to upload.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ValidationError("File exceeds the 8 MB limit.");
    }
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      throw new ValidationError("Only JPEG, PNG, WebP, GIF, or PDF files are allowed.");
    }
    const meta = mediaMetaSchema.safeParse({
      type: formData.get("type") ?? "FACTORY_PHOTO",
      caption: formData.get("caption") ?? "",
    });
    if (!meta.success) throw new ValidationError(meta.error.issues[0]?.message);

    const buffer = Buffer.from(await file.arrayBuffer());
    // Persist bytes first; if the DB write fails, remove the orphaned object.
    const stored = await storage.put(
      { buffer, fileName: file.name, contentType: file.type },
      { prefix: `manufacturers/${ctx.company.id}` },
    );
    try {
      await db.$transaction(async (tx) => {
        const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
        const asset = await tx.mediaAsset.create({
          data: {
            manufacturerId,
            type: meta.data.type,
            url: stored.url,
            storageKey: stored.key,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
            caption: meta.data.caption || null,
          },
        });
        await logAudit(
          {
            userId: ctx.user.id,
            companyId: ctx.company.id,
            action: "media.uploaded",
            metadata: { mediaId: asset.id, type: asset.type },
          },
          tx,
        );
      });
    } catch (e) {
      await storage.remove(stored.key).catch(() => {});
      throw e;
    }

    revalidatePath("/dashboard/profile");
  });
}

/** Delete a media asset owned by the active company. */
export async function deleteMediaAsset(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    const asset = await db.mediaAsset.findFirst({
      where: { id: parsed.data.id, manufacturer: { companyId: ctx.company.id } },
      select: { id: true, storageKey: true },
    });
    if (!asset) throw new NotFoundError("Media not found.");

    await db.$transaction(async (tx) => {
      await tx.mediaAsset.delete({ where: { id: asset.id } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "media.deleted",
          metadata: { mediaId: asset.id },
        },
        tx,
      );
    });

    if (asset.storageKey) await storage.remove(asset.storageKey).catch(() => {});
    revalidatePath("/dashboard/profile");
  });
}
