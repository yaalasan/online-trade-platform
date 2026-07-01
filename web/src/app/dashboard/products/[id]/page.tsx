import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { ProductSpec } from "@/lib/validation";
import { Card, CardContent, CardHeader, CardTitle, ProductStatusBadge } from "@/components/ui/primitives";
import { ProductForm, type ProductFormValues } from "@/components/product-form";
import { DeleteProductButton } from "@/components/delete-product-button";
import { getT } from "@/lib/i18n/server";
import { ProductDetailClient } from "./product-detail-client";
import type { Product } from "@/components/product/types";

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

  const productForDetail: Product = {
    id: product.id,
    title: product.name,
    priceMin: product.priceMin ? Number(product.priceMin) : 0,
    priceMax: product.priceMax ? Number(product.priceMax) : null,
    priceUnit: product.unit,
    moq: product.moq,
    moqUnit: product.unit,
    supplier: {
      id: company.id,
      name: company.name,
      kind: company.type,
      location: "",
      verified: false,
      audited: false,
    },
    media: product.images.map((img) => ({
      id: img.id,
      type: "image" as const,
      url: img.url,
      thumbUrl: img.url,
      sortOrder: img.position,
    })),
    specs: specs.map((s, i) => ({
      id: String(i),
      label: s.name,
      value: s.value,
      sortOrder: i,
    })),
    variants: [],
    priceTiers: [],
    packaging: {
      leadTime: product.leadTimeDays ? `${product.leadTimeDays} days` : null,
    },
    descriptionBlocks: product.description
      ? [{ id: "desc-0", type: "text" as const, sortOrder: 0, content: { text: product.description } }]
      : [],
    faqs: [],
  };

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

      <ProductDetailClient product={productForDetail} canManage={canManage} />
    </div>
  );
}
