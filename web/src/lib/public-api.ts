import "server-only";
import type { Prisma } from "@prisma/client";
import type { ProductSpec } from "@/lib/validation";

/**
 * JSON shapes for the public API bridge consumed by the Flask buyer site. Kept
 * deliberately flat and stack-agnostic so Flask can map them to its own view
 * model without knowing the Prisma schema. Decimals/Dates are stringified; image
 * URLs are made absolute against the portal origin so they load cross-origin.
 */

/** Prefix a stored ("/uploads/..") or already-absolute URL with the portal origin. */
export function toAbsolute(origin: string, url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

type ProductCard = Prisma.ProductGetPayload<{
  include: {
    images: true;
    categories: { include: { category: { select: { name: true } } } };
    manufacturer: { select: { id: true; country: true; verification: true; company: { select: { name: true } } } };
  };
}>;

export function shapeProductCard(origin: string, p: ProductCard) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.categories[0]?.category.name ?? null,
    supplier: p.manufacturer.company.name,
    supplierId: p.manufacturer.id,
    country: p.manufacturer.country,
    verified: p.manufacturer.verification === "VERIFIED",
    priceMin: p.priceMin ? p.priceMin.toString() : null,
    priceMax: p.priceMax ? p.priceMax.toString() : null,
    currency: p.currency,
    moq: p.moq,
    unit: p.unit,
    leadTimeDays: p.leadTimeDays,
    image: toAbsolute(origin, p.images[0]?.url ?? null),
  };
}

type ProductDetail = Prisma.ProductGetPayload<{
  include: {
    images: true;
    categories: { include: { category: { select: { name: true } } } };
    manufacturer: { select: { id: true; country: true; verification: true; company: { select: { name: true } } } };
  };
}>;

export function shapeProductDetail(origin: string, p: ProductDetail) {
  return {
    ...shapeProductCard(origin, p),
    description: p.description,
    leadTimeDays: p.leadTimeDays,
    categories: p.categories.map((c) => c.category.name),
    images: p.images.map((img) => toAbsolute(origin, img.url)).filter(Boolean),
    specifications: (p.specifications as unknown as ProductSpec[] | null) ?? [],
  };
}

type SupplierCard = Prisma.ManufacturerGetPayload<{
  select: {
    id: true;
    country: true;
    city: true;
    verification: true;
    company: { select: { name: true } };
    _count: { select: { products: true } };
  };
}>;

export function shapeSupplierCard(s: SupplierCard) {
  return {
    id: s.id,
    name: s.company.name,
    country: s.country,
    city: s.city,
    verified: s.verification === "VERIFIED",
    productCount: s._count.products,
  };
}
