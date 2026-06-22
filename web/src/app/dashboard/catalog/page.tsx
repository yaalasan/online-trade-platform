import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { searchProducts, listCategories, parseCatalogFilters } from "@/lib/catalog";
import { formatPriceRange } from "@/lib/utils";
import { Card, CardContent, Input, Label, Select } from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { getT } from "@/lib/i18n/server";

type SearchParams = Promise<{ q?: string; category?: string; country?: string; page?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  await getActiveContext(); // gated by layout
  const t = await getT();

  // Shared catalog read model — identical ACTIVE-only behavior as the public store.
  const f = parseCatalogFilters(await searchParams);
  const { q, category, country } = f;
  const [{ products, page, totalPages }, categories] = await Promise.all([
    searchProducts(f),
    listCategories(),
  ]);

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
      <h1 className="text-2xl font-semibold">{t("catalog.title")}</h1>

      <Card>
        <CardContent>
          <form method="get" className="grid items-end gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="q">{t("common.search")}</Label>
              <Input id="q" name="q" defaultValue={q} placeholder={t("products.searchPlaceholder")} />
            </div>
            <div>
              <Label htmlFor="category">{t("products.category")}</Label>
              <Select id="category" name="category" defaultValue={category}>
                <option value="">{t("common.all")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="country">{t("catalog.supplierCountry")}</Label>
              <Input id="country" name="country" maxLength={2} defaultValue={country} placeholder="CN" />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                {t("products.applyFilters")}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {products.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">{t("catalog.noneMatch")}</p>
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
                      <span className="text-xs text-neutral-400">{t("products.noImage")}</span>
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
                      · {t("products.moq")} {p.moq.toLocaleString()} {p.unit}
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
