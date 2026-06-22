"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/server/products";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export type ProductFormValues = {
  name: string;
  description: string;
  moq: string;
  unit: string;
  leadTimeDays: string;
  priceMin: string;
  priceMax: string;
  currency: string;
  status: string;
  specifications: string; // "name: value" per line
};

const EMPTY: ProductFormValues = {
  name: "",
  description: "",
  moq: "",
  unit: "pcs",
  leadTimeDays: "",
  priceMin: "",
  priceMax: "",
  currency: "",
  status: "DRAFT",
  specifications: "",
};

const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

type Category = { id: string; name: string };

export function ProductForm({
  productId,
  defaults,
  categories,
  selectedCategoryIds,
}: {
  productId?: string;
  defaults?: ProductFormValues;
  categories: Category[];
  selectedCategoryIds?: string[];
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const values = defaults ?? EMPTY;
  const selected = new Set(selectedCategoryIds ?? []);
  const isEdit = Boolean(productId);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      if (isEdit) {
        formData.set("id", productId as string);
        const res = await updateProduct(formData);
        if (res.ok) {
          setMsg({ kind: "ok", text: t("company.saved") });
          router.refresh();
        } else {
          setMsg({ kind: "err", text: res.error });
        }
      } else {
        const res = await createProduct(formData);
        if (res.ok) router.push(`/dashboard/products/${res.data.productId}`);
        else setMsg({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <div>
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input id="name" name="name" required defaultValue={values.name} placeholder={t("productForm.namePlaceholder")} />
        </div>

        <div>
          <Label htmlFor="description">{t("common.description")}</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={values.description} placeholder={t("productForm.descriptionPlaceholder")} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="moq">{t("products.moq")}</Label>
            <Input id="moq" name="moq" type="number" min={1} required defaultValue={values.moq} placeholder="1000" />
          </div>
          <div>
            <Label htmlFor="unit">{t("productForm.unit")}</Label>
            <Input id="unit" name="unit" required defaultValue={values.unit} placeholder="pcs" />
          </div>
          <div>
            <Label htmlFor="leadTimeDays">{t("productForm.leadTime")}</Label>
            <Input id="leadTimeDays" name="leadTimeDays" type="number" min={1} defaultValue={values.leadTimeDays} placeholder="30" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="priceMin">{t("productForm.priceMin")}</Label>
            <Input id="priceMin" name="priceMin" type="number" min={0} step="0.01" defaultValue={values.priceMin} placeholder="1.20" />
          </div>
          <div>
            <Label htmlFor="priceMax">{t("productForm.priceMax")}</Label>
            <Input id="priceMax" name="priceMax" type="number" min={0} step="0.01" defaultValue={values.priceMax} placeholder="1.80" />
          </div>
          <div>
            <Label htmlFor="currency">{t("productForm.currency")}</Label>
            <Input id="currency" name="currency" maxLength={3} defaultValue={values.currency} placeholder="USD" />
          </div>
        </div>

        <div>
          <Label htmlFor="status">{t("common.status")}</Label>
          <Select id="status" name="status" defaultValue={values.status}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.product.${s}`)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-neutral-500">{t("productForm.activeOnlyNote")}</p>
        </div>

        <div>
          <Label htmlFor="specifications">{t("catalog.specifications")}</Label>
          <Textarea
            id="specifications"
            name="specifications"
            rows={4}
            defaultValue={values.specifications}
            placeholder={t("productForm.specsPlaceholder")}
          />
          <p className="mt-1 text-xs text-neutral-500">{t("productForm.specsHint")}</p>
        </div>

        <div>
          <Label>{t("suppliers.categoriesLabel")}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={c.id}
                  defaultChecked={selected.has(c.id)}
                  className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : isEdit ? t("company.saveChanges") : t("productForm.createProduct")}
        </Button>
      </fieldset>

      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
