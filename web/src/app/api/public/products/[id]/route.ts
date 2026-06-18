import { NextResponse, type NextRequest } from "next/server";
import { getActiveProduct } from "@/lib/catalog";
import { shapeProductDetail } from "@/lib/public-api";

/** Public detail for a single ACTIVE product. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = process.env.NEXT_PUBLIC_PORTAL_URL || req.nextUrl.origin;
  const { id } = await params;

  const product = await getActiveProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({ product: shapeProductDetail(origin, product) });
}
