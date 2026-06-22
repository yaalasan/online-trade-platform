import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { ProductSpec } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle, ProductStatusBadge } from "@/components/ui/primitives";
import { ProductForm, type ProductFormValues } from "@/components/product-form";
import { ProductImageManager, type ProductImageView } from "@/components/product-image-manager";
import { DeleteProductButton } from "@/components/delete-product-button";
import { getT } from "@/lib/i18n/server";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = (await getActiveContext())!;
  const { company, role } = ctx;
  const canManage = ROLE_RANK[role] >= ROLE_RANK.MANAGER;
  const t = await getT();

  const product = await db.product.findFirst({
    where: { id, manufacturer: { companyId: company.id } },
    include: {
      images: { orderBy: { position: "asc" } },
      categories: { select: { categoryId: true } },
    },
  });
  if (!product) notFound();

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const specs = (product.specifications as unknown as ProductSpec[] | null) ?? [];

  const defaults: ProductFormValues = {
    name: product.name,
    description: product.description ?? "",
    moq: String(product.moq),
    unit: product.unit,
    leadTimeDays: product.leadTimeDays?.toString() ?? "",
    priceMin: product.priceMin ? product.priceMin.toString() : "",
    priceMax: product.priceMax ? product.priceMax.toString() : "",
    currency: product.currency ?? "",
    status: product.status,
    specifications: specs.map((s) => `${s.name}: ${s.value}`).join("\n"),
  };

  const images: ProductImageView[] = product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/products" className="text-sm text-neutral-500 hover:text-brand">
            {t("products.backToProducts")}
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <ProductStatusBadge status={product.status} />
          </div>
        </div>
        {canManage && <DeleteProductButton productId={product.id} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("products.images")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImageManager productId={product.id} images={images} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("products.details")}</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ProductForm
              productId={product.id}
              defaults={defaults}
              categories={categories}
              selectedCategoryIds={product.categories.map((c) => c.categoryId)}
            />
          ) : (
            <p className="text-sm text-neutral-500">{t("products.roleViewOnly")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
