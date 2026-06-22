"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateManufacturerProfile } from "@/server/manufacturer";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export type ManufacturerProfileValues = {
  factoryName: string;
  description: string;
  yearEstablished: string;
  employeeCount: string;
  annualOutput: string;
  productionCapacity: string;
  city: string;
  province: string;
  country: string;
  address: string;
};

export function ManufacturerProfileForm({
  values,
  readOnly,
}: {
  values: ManufacturerProfileValues;
  readOnly: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await updateManufacturerProfile(formData);
      if (res.ok) {
        setMsg({ kind: "ok", text: t("company.saved") });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <fieldset disabled={readOnly || pending} className="space-y-4">
        <div>
          <Label htmlFor="factoryName">{t("profileForm.factoryName")}</Label>
          <Input id="factoryName" name="factoryName" defaultValue={values.factoryName} placeholder={t("profileForm.factoryNamePlaceholder")} />
        </div>
        <div>
          <Label htmlFor="description">{t("profileForm.companyDescription")}</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={values.description}
            placeholder={t("profileForm.descriptionPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="yearEstablished">{t("suppliers.yearEstablished")}</Label>
            <Input id="yearEstablished" name="yearEstablished" type="number" min={1800} defaultValue={values.yearEstablished} placeholder="2009" />
          </div>
          <div>
            <Label htmlFor="employeeCount">{t("suppliers.employees")}</Label>
            <Input id="employeeCount" name="employeeCount" type="number" min={1} defaultValue={values.employeeCount} placeholder="250" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="annualOutput">{t("suppliers.annualOutput")}</Label>
            <Input id="annualOutput" name="annualOutput" defaultValue={values.annualOutput} placeholder="5M units / year" />
          </div>
          <div>
            <Label htmlFor="productionCapacity">{t("suppliers.productionCapacity")}</Label>
            <Input id="productionCapacity" name="productionCapacity" defaultValue={values.productionCapacity} placeholder="20,000 units / month" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="city">{t("profileForm.city")}</Label>
            <Input id="city" name="city" defaultValue={values.city} placeholder="Shenzhen" />
          </div>
          <div>
            <Label htmlFor="province">{t("profileForm.province")}</Label>
            <Input id="province" name="province" defaultValue={values.province} placeholder="Guangdong" />
          </div>
          <div>
            <Label htmlFor="country">{t("suppliers.country")}</Label>
            <Input id="country" name="country" maxLength={2} defaultValue={values.country} placeholder="CN" />
          </div>
        </div>

        <div>
          <Label htmlFor="address">{t("suppliers.address")}</Label>
          <Input id="address" name="address" defaultValue={values.address} placeholder="Building 4, Industrial Park…" />
        </div>

        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("profileForm.saveProfile")}
          </Button>
        )}
      </fieldset>

      {readOnly && (
        <p className="text-sm text-neutral-500">{t("profileForm.viewOnly")}</p>
      )}
      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
