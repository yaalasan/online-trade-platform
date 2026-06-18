import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupplier } from "@/lib/catalog";
import { toAbsolute } from "@/lib/public-api";

/** Public supplier profile plus its ACTIVE catalog. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = process.env.NEXT_PUBLIC_PORTAL_URL || req.nextUrl.origin;
  const { id } = await params;

  const s = await getPublicSupplier(id);
  if (!s) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  return NextResponse.json({
    supplier: {
      id: s.id,
      name: s.company.name,
      description: s.company.description,
      website: s.company.website,
      country: s.country,
      city: s.city,
      province: s.province,
      verified: s.verification === "VERIFIED",
      certifications: s.certifications.map((c) => ({ name: c.name, issuer: c.issuer })),
      products: s.products.map((p) => ({
        id: p.id,
        name: p.name,
        priceMin: p.priceMin ? p.priceMin.toString() : null,
        priceMax: p.priceMax ? p.priceMax.toString() : null,
        currency: p.currency,
        moq: p.moq,
        unit: p.unit,
        image: toAbsolute(origin, p.images[0]?.url ?? null),
      })),
    },
  });
}
