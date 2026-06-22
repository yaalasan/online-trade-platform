"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProductImage, deleteProductImage } from "@/server/products";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export type ProductImageView = {
  id: string;
  url: string;
  alt: string | null;
};

export function ProductImageManager({
  productId,
  images,
  canManage,
}: {
  productId: string;
  images: ProductImageView[];
  canManage: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      {images.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("productImages.none")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <figure key={img.id} className="overflow-hidden rounded-md border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt ?? "product image"} className="h-28 w-full object-cover" />
              {canManage && (
                <figcaption className="flex justify-end p-1">
                  <DeleteImageButton id={img.id} />
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {canManage && <UploadImageForm productId={productId} />}
    </div>
  );
}

function UploadImageForm({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("productId", productId);
    start(async () => {
      const res = await uploadProductImage(formData);
      if (res.ok) {
        (document.getElementById("upload-product-image-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form id="upload-product-image-form" action={onSubmit} className="space-y-3 rounded-md border border-neutral-200 p-4">
      <p className="text-sm font-medium">{t("productImages.addImage")}</p>
      <div>
        <Label htmlFor="img-alt">{t("productImages.altText")}</Label>
        <Input id="img-alt" name="alt" placeholder={t("productImages.altPlaceholder")} />
      </div>
      <div>
        <Label htmlFor="img-file">{t("productImages.fileLabel")}</Label>
        <Input
          id="img-file"
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="h-auto py-1.5"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t("kybDocs.uploading") : t("productImages.uploadImage")}
      </Button>
    </form>
  );
}

function DeleteImageButton({ id }: { id: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("productImages.deleteConfirm"))) return;
        const fd = new FormData();
        fd.set("id", id);
        start(async () => {
          const res = await deleteProductImage(fd);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      ✕
    </Button>
  );
}
