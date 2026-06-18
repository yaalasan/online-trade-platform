import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { ROLE_RANK } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { ProductForm } from "@/components/product-form";

export default async function NewProductPage() {
  const ctx = (await getActiveContext())!;
  if (ROLE_RANK[ctx.role] < ROLE_RANK.MANAGER) redirect("/dashboard/products");

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-neutral-500 hover:text-brand">
          ← Back to products
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New product</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
