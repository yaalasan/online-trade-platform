"use client";

import { useCallback, useRef, useTransition, useState } from "react";
import ProductDetail from "@/components/product/ProductDetail";
import type { Product, MediaType } from "@/components/product/types";
import { saveProductSpecs, uploadProductImage } from "@/server/products";

interface Props {
  product: Product;
  canManage: boolean;
}

export function ProductDetailClient({ product, canManage }: Props) {
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadMedia = useCallback(
    (type: MediaType) => {
      if (!canManage || !fileInputRef.current) return;
      const isVideo = type === "video";
      fileInputRef.current.accept = isVideo
        ? "video/mp4,video/webm,video/ogg"
        : "image/jpeg,image/png,image/webp,image/gif";
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    },
    [canManage],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("productId", product.id);
        fd.append("file", file);
        const result = await uploadProductImage(fd);
        if (!result.ok) setUploadError(result.error);
      } catch {
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [product.id],
  );

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 bg-white">
        <h2 className="text-base font-semibold">Product preview &amp; media</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Gallery and specification edits are saved automatically.</p>
        {uploading && <p className="text-sm text-blue-600 mt-1">Uploading…</p>}
        {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />
      <ProductDetail
        product={product}
        editable={canManage}
        onSpecsChange={handleSpecsChange}
        onUploadMedia={canManage ? handleUploadMedia : undefined}
      />
    </div>
  );
}
