import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getActiveContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPriceRange } from "@/lib/utils";
import { Card, CardContent, Input, Label, Select } from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 12;

type SearchParams = Promise<{ q?: string; category?: string; country?: string; page?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  await getActiveContext(); // gated by layout
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const country = (sp.country ?? "").trim().toUpperCase().slice(0, 2);
  const page = Math.max(1, Number(sp.page) || 1);

  // Only ACTIVE products are visible to buyers.
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  if (category) where.categories = { some: { categoryId: category } };
  if (country) where.manufacturer = { country };
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
  ];

  const [total, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        manufacturer: { select: { id: true, country: true, company: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/catalog?${qs}` : "/dashboard/catalog";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catalog</h1>

      <Card>
        <CardContent>
          <form method="get" className="grid items-end gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Product name or keyword" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue={category}>
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="country">Supplier country</Label>
              <Input id="country" name="country" maxLength={2} defaultValue={country} placeholder="CN" />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                Apply filters
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {products.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">No products match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.id} href={`/dashboard/catalog/${p.id}`}>
                <Card className="h-full transition-colors hover:border-brand">
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-t-lg bg-neutral-50">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0].url} alt={p.images[0].alt ?? p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-neutral-400">No image</span>
                    )}
                  </div>
                  <CardContent className="space-y-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {p.manufacturer.company.name}
                      {p.manufacturer.country ? ` · ${p.manufacturer.country}` : ""}
                    </p>
                    <p className="text-xs text-neutral-700">
                      {formatPriceRange(
                        p.priceMin ? p.priceMin.toString() : null,
                        p.priceMax ? p.priceMax.toString() : null,
                        p.currency,
                      )}{" "}
                      · MOQ {p.moq.toLocaleString()} {p.unit}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} makeHref={makeHref} />
        </>
      )}
    </div>
  );
}
