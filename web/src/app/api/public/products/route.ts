import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/catalog";
import { shapeProductCard } from "@/lib/public-api";

/** Public catalog feed for the Flask buyer site: ACTIVE products only. */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_PORTAL_URL || req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;

  const { products, total, page, totalPages } = await searchProducts({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    country: sp.get("country") ?? undefined,
    page: Number(sp.get("page")) || 1,
  });

  return NextResponse.json({
    products: products.map((p) => shapeProductCard(origin, p)),
    total,
    page,
    totalPages,
  });
}
