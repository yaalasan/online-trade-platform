import Link from "next/link";
import type { Prisma, ProductStatus } from "@prisma/client";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, Input, Label, Select, ProductStatusBadge } from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { getT } from "@/lib/i18n/server";

const PAGE_SIZE = 12;
const STATUS_VALUES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

type SearchParams = Promise<{ q?: string; status?: string; category?: string; page?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.MANAGER;
  const t = await getT();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const status = STATUS_VALUES.includes(sp.status as ProductStatus) ? (sp.status as ProductStatus) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProductWhereInput = { manufacturer: { companyId: company.id } };
  if (status) where.status = status;
  if (category) where.categories = { some: { categoryId: category } };
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
        categories: { include: { category: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/products?${qs}` : "/dashboard/products";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("products.title")}</h1>
        {canManage && (
          <Link href="/dashboard/products/new" className={buttonVariants()}>
            {t("products.newProduct")}
          </Link>
        )}
      </div>

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
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select id="status" name="status" defaultValue={status}>
                <option value="">{t("products.statusAny")}</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.product.${s}`)}
                  </option>
                ))}
              </Select>
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
            <p className="text-sm text-neutral-500">
              {t("products.noneMatch")}{" "}
              {canManage ? t("products.createFirst") : t("products.askManager")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.id} href={`/dashboard/products/${p.id}`}>
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <ProductStatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-neutral-500">
                      {t("products.moq")} {p.moq.toLocaleString()} {p.unit}
                      {p.categories[0] ? ` · ${p.categories[0].category.name}` : ""}
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
