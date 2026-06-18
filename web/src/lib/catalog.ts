import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Catalog read model — the single source of truth for browsing ACTIVE products,
 * shared by the authenticated dashboard catalog and the public storefront so the
 * two can never drift. Only ACTIVE products are ever returned.
 */

export const CATALOG_PAGE_SIZE = 12;

export type CatalogFilters = {
  q?: string;
  category?: string;
  country?: string;
  page?: number;
};

/** Normalize raw (often URL) filter input into a clean, bounded shape. */
export function parseCatalogFilters(raw: {
  q?: string;
  category?: string;
  country?: string;
  page?: string;
}): Required<CatalogFilters> {
  return {
    q: (raw.q ?? "").trim(),
    category: (raw.category ?? "").trim(),
    country: (raw.country ?? "").trim().toUpperCase().slice(0, 2),
    page: Math.max(1, Number(raw.page) || 1),
  };
}

function buildWhere(f: Required<CatalogFilters>): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  if (f.category) where.categories = { some: { categoryId: f.category } };
  if (f.country) where.manufacturer = { country: f.country };
  if (f.q)
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
    ];
  return where;
}

/** Paginated ACTIVE-product search with a thumbnail and supplier summary. */
export async function searchProducts(filters: CatalogFilters) {
  const f = parseCatalogFilters({
    q: filters.q,
    category: filters.category,
    country: filters.country,
    page: filters.page ? String(filters.page) : undefined,
  });
  const where = buildWhere(f);

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        categories: { include: { category: { select: { name: true } } }, take: 1 },
        manufacturer: { select: { id: true, country: true, verification: true, company: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (f.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    }),
  ]);

  return {
    products,
    total,
    page: f.page,
    totalPages: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  };
}

/** Shared category list for filter dropdowns. */
export function listCategories() {
  return db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** A single ACTIVE product with everything a detail page needs, or null. */
export function getActiveProduct(id: string) {
  return db.product.findFirst({
    where: { id, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: { include: { category: { select: { name: true } } } },
      manufacturer: {
        select: { id: true, country: true, verification: true, company: { select: { name: true } } },
      },
    },
  });
}

/** Public supplier directory: manufacturers that have at least one ACTIVE product. */
export function listPublicSuppliers() {
  return db.manufacturer.findMany({
    where: { products: { some: { status: "ACTIVE" } } },
    select: {
      id: true,
      country: true,
      city: true,
      verification: true,
      company: { select: { name: true } },
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { company: { name: "asc" } },
  });
}

/** A single supplier profile plus its ACTIVE catalog, or null. */
export function getPublicSupplier(id: string) {
  return db.manufacturer.findUnique({
    where: { id },
    include: {
      company: { select: { name: true, description: true, website: true } },
      certifications: { orderBy: { createdAt: "asc" } },
      products: {
        where: { status: "ACTIVE" },
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}
