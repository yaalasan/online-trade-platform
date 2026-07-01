"use client";

import { useCallback, useTransition } from "react";
import ProductDetail from "@/components/product/ProductDetail";
import type { Product } from "@/components/product/types";
import { saveProductSpecs } from "@/server/products";

interface Props {
  product: Product;
  canManage: boolean;
}

export function ProductDetailClient({ product, canManage }: Props) {
  const [, startTransition] = useTransition();

  const handleSpecsChange = useCallback(
    (specs: Product["specs"]) => {
      if (!canManage) return;
      startTransition(async () => {
        await saveProductSpecs(
          product.id,
          specs.map((s) => ({ label: s.label, value: s.value })),
        );
      });
    },
    [product.id, canManage],
  );

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 bg-white">
        <h2 className="text-base font-semibold">Product preview &amp; media</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Gallery and specification edits are saved automatically.</p>
      </div>
      <ProductDetail
        product={product}
        editable={canManage}
        onSpecsChange={handleSpecsChange}
      />
    </div>
  );
}
