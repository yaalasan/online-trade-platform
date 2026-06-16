import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPriceRange } from "@/lib/utils";
import type { ProductSpec } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle, VerificationBadge } from "@/components/ui/primitives";
import { InquiryForm } from "@/components/inquiry-form";

export default async function CatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  await getActiveContext(); // gated by layout
  const { id } = await params;

  // Buyers only see ACTIVE products.
  const product = await db.product.findFirst({
    where: { id, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: { include: { category: { select: { name: true } } } },
      manufacturer: { select: { id: true, country: true, verification: true, company: { select: { name: true } } } },
    },
  });
  if (!product) notFound();

  const specs = (product.specifications as unknown as ProductSpec[] | null) ?? [];
  const price = formatPriceRange(
    product.priceMin ? product.priceMin.toString() : null,
    product.priceMax ? product.priceMax.toString() : null,
    product.currency,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/catalog" className="text-sm text-neutral-500 hover:text-brand">
          ← Back to catalog
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Link href={`/dashboard/suppliers/${product.manufacturer.id}`} className="hover:text-brand">
            {product.manufacturer.company.name}
          </Link>
          {product.manufacturer.country ? `· ${product.manufacturer.country}` : ""}
          <VerificationBadge status={product.manufacturer.verification} />
        </p>
        <div className="mt-3">
          <InquiryForm kind="PRODUCT" targetProductId={product.id} label="Request introduction / quote" />
        </div>
      </div>

      {product.images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {product.images.map((img) => (
            <div key={img.id} className="overflow-hidden rounded-md border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt ?? product.name} className="h-32 w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Price" value={price} />
          <Detail label="MOQ" value={`${product.moq.toLocaleString()} ${product.unit}`} />
          <Detail label="Lead time" value={product.leadTimeDays ? `${product.leadTimeDays} days` : "—"} />
          <Detail
            label="Categories"
            value={product.categories.map((c) => c.category.name).join(", ") || "—"}
          />
          {product.description && (
            <div className="sm:col-span-2">
              <Detail label="Description" value={product.description} />
            </div>
          )}
        </CardContent>
      </Card>

      {specs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-neutral-100 text-sm">
              {specs.map((s, i) => (
                <div key={`${s.name}-${i}`} className="flex justify-between gap-4 py-2">
                  <dt className="text-neutral-500">{s.name}</dt>
                  <dd className="text-right font-medium text-neutral-800">{s.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="whitespace-pre-wrap text-neutral-800">{value}</p>
    </div>
  );
}
