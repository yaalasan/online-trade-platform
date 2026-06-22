"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "@/server/companies";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export function CreateCompanyForm() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await createCompany(formData);
      if (res.ok) router.push("/dashboard");
      else setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">{t("company.name")}</Label>
        <Input id="name" name="name" required placeholder={t("company.namePlaceholder")} />
      </div>
      <div>
        <Label htmlFor="type">{t("company.type")}</Label>
        <Select id="type" name="type" defaultValue="MANUFACTURER">
          <option value="MANUFACTURER">{t("company.typeManufacturer")}</option>
          <option value="BUYER">{t("company.typeBuyer")}</option>
          <option value="BOTH">{t("company.typeBoth")}</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="country">{t("suppliers.country")}</Label>
          <Input id="country" name="country" maxLength={2} placeholder="CN" />
        </div>
        <div>
          <Label htmlFor="website">{t("company.website")}</Label>
          <Input id="website" name="website" type="url" placeholder="https://…" />
        </div>
      </div>
      <div>
        <Label htmlFor="description">{t("common.description")}</Label>
        <Textarea id="description" name="description" rows={3} placeholder={t("company.descriptionPlaceholder")} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t("common.creating") : t("company.create")}
      </Button>
    </form>
  );
}
