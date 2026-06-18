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
  createProductSchema,
  updateProductSchema,
  productSpecSchema,
  idSchema,
  setCategoriesSchema,
  type CreateProductInput,
  type ProductSpec,
} from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";
import { z } from "zod";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const specListSchema = z.array(productSpecSchema).max(50, "At most 50 specifications");

function assertCanManage(role: MembershipRole): void {
  if (ROLE_RANK[role] < ROLE_RANK.MANAGER) {
    throw new AuthorizationError("Your role cannot manage products.");
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

/** Parse the "name: value" textarea into validated spec rows. */
function parseSpecs(raw: unknown): ProductSpec[] {
  if (typeof raw !== "string") return [];
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { name: line, value: "" };
      return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((s) => s.name && s.value);
  const parsed = specListSchema.safeParse(rows);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
  return parsed.data;
}

/** Map validated scalar input + specs to the Product column shape. */
function toProductData(input: CreateProductInput, specs: ProductSpec[]) {
  return {
    name: input.name,
    description: input.description || null,
    moq: input.moq,
    unit: input.unit,
    leadTimeDays: input.leadTimeDays ?? null,
    priceMin: input.priceMin ?? null,
    priceMax: input.priceMax ?? null,
    currency: input.currency ?? null,
    status: input.status,
    specifications: specs as unknown as Prisma.InputJsonValue,
  };
}

function scalarInput(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    moq: formData.get("moq"),
    unit: formData.get("unit"),
    leadTimeDays: formData.get("leadTimeDays") ?? "",
    priceMin: formData.get("priceMin") ?? "",
    priceMax: formData.get("priceMax") ?? "",
    currency: formData.get("currency") ?? "",
    status: formData.get("status") ?? "DRAFT",
  };
}

/** Resolve and validate the submitted category ids against the active company. */
function parseCategoryIds(formData: FormData): string[] {
  const parsed = setCategoriesSchema.safeParse({
    categoryIds: formData.getAll("categoryIds").map(String),
  });
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
  return parsed.data.categoryIds;
}

async function linkCategories(
  tx: Prisma.TransactionClient,
  productId: string,
  categoryIds: string[],
): Promise<void> {
  await tx.productCategory.deleteMany({ where: { productId } });
  if (categoryIds.length === 0) return;
  const valid = await tx.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  if (valid.length > 0) {
    await tx.productCategory.createMany({
      data: valid.map((c) => ({ productId, categoryId: c.id })),
      skipDuplicates: true,
    });
  }
}

/** Create a product in the active company's catalog. */
export async function createProduct(formData: FormData): Promise<ActionResult<{ productId: string }>> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = createProductSchema.safeParse(scalarInput(formData));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const specs = parseSpecs(formData.get("specifications"));
    const categoryIds = parseCategoryIds(formData);
    const data = toProductData(parsed.data, specs);

    const product = await db.$transaction(async (tx) => {
      const manufacturerId = await ensureManufacturerId(tx, ctx.company.id);
      const created = await tx.product.create({ data: { ...data, manufacturerId } });
      await linkCategories(tx, created.id, categoryIds);
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "product.created",
          metadata: { productId: created.id, name: created.name, status: created.status },
        },
        tx,
      );
      return created;
    });

    revalidatePath("/dashboard/products");
    return { productId: product.id };
  });
}

/** Update a product owned by the active company. */
export async function updateProduct(formData: FormData): Promise<ActionResult<{ productId: string }>> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = updateProductSchema.safeParse({ ...scalarInput(formData), id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { id, ...rest } = parsed.data;
    const specs = parseSpecs(formData.get("specifications"));
    const categoryIds = parseCategoryIds(formData);
    const data = toProductData(rest, specs);

    const existing = await db.product.findFirst({
      where: { id, manufacturer: { companyId: ctx.company.id } },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError("Product not found in this company.");

    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id: existing.id }, data });
      await linkCategories(tx, existing.id, categoryIds);
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "product.updated",
          metadata: {
            productId: existing.id,
            name: data.name,
            statusFrom: existing.status,
            statusTo: data.status,
          },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${existing.id}`);
    return { productId: existing.id };
  });
}

/** Delete a product owned by the active company. */
export async function deleteProduct(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    const existing = await db.product.findFirst({
      where: { id: parsed.data.id, manufacturer: { companyId: ctx.company.id } },
      select: { id: true, name: true, images: { select: { storageKey: true } } },
    });
    if (!existing) throw new NotFoundError("Product not found in this company.");

    await db.$transaction(async (tx) => {
      await tx.product.delete({ where: { id: existing.id } }); // images/categories cascade
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "product.deleted",
          metadata: { productId: existing.id, name: existing.name },
        },
        tx,
      );
    });

    // Clean up stored image bytes after the DB rows are gone.
    for (const img of existing.images) {
      if (img.storageKey) await storage.remove(img.storageKey).catch(() => {});
    }
    revalidatePath("/dashboard/products");
  });
}

/** Upload an image for a product owned by the active company. */
export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const productId = String(formData.get("productId") ?? "");
    if (!productId) throw new ValidationError("Missing product.");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose an image to upload.");
    if (file.size > MAX_IMAGE_BYTES) throw new ValidationError("Image exceeds the 8 MB limit.");
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new ValidationError("Only JPEG, PNG, WebP, or GIF images are allowed.");

    const product = await db.product.findFirst({
      where: { id: productId, manufacturer: { companyId: ctx.company.id } },
      select: { id: true },
    });
    if (!product) throw new NotFoundError("Product not found in this company.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put(
      { buffer, fileName: file.name, contentType: file.type },
      { prefix: `products/${ctx.company.id}/${product.id}` },
    );
    try {
      await db.$transaction(async (tx) => {
        const last = await tx.productImage.findFirst({
          where: { productId: product.id },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        const image = await tx.productImage.create({
          data: {
            productId: product.id,
            url: stored.url,
            storageKey: stored.key,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
            alt: (formData.get("alt") as string | null)?.slice(0, 200) || null,
            position: (last?.position ?? -1) + 1,
          },
        });
        await logAudit(
          {
            userId: ctx.user.id,
            companyId: ctx.company.id,
            action: "product.image_added",
            metadata: { productId: product.id, imageId: image.id },
          },
          tx,
        );
      });
    } catch (e) {
      await storage.remove(stored.key).catch(() => {});
      throw e;
    }

    revalidatePath(`/dashboard/products/${product.id}`);
  });
}

/** Delete a product image owned by the active company. */
export async function deleteProductImage(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();
    assertCanManage(ctx.role);

    const parsed = idSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

    const image = await db.productImage.findFirst({
      where: { id: parsed.data.id, product: { manufacturer: { companyId: ctx.company.id } } },
      select: { id: true, productId: true, storageKey: true },
    });
    if (!image) throw new NotFoundError("Image not found.");

    await db.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: image.id } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "product.image_deleted",
          metadata: { productId: image.productId, imageId: image.id },
        },
        tx,
      );
    });

    if (image.storageKey) await storage.remove(image.storageKey).catch(() => {});
    revalidatePath(`/dashboard/products/${image.productId}`);
  });
}
