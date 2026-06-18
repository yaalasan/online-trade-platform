"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateManufacturerProfile } from "@/server/manufacturer";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";

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
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await updateManufacturerProfile(formData);
      if (res.ok) {
        setMsg({ kind: "ok", text: "Saved." });
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
          <Label htmlFor="factoryName">Factory name</Label>
          <Input id="factoryName" name="factoryName" defaultValue={values.factoryName} placeholder="Shenzhen Acme Works" />
        </div>
        <div>
          <Label htmlFor="description">Company description</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={values.description}
            placeholder="What you make, key markets, differentiators…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="yearEstablished">Year established</Label>
            <Input id="yearEstablished" name="yearEstablished" type="number" min={1800} defaultValue={values.yearEstablished} placeholder="2009" />
          </div>
          <div>
            <Label htmlFor="employeeCount">Employees</Label>
            <Input id="employeeCount" name="employeeCount" type="number" min={1} defaultValue={values.employeeCount} placeholder="250" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="annualOutput">Annual output</Label>
            <Input id="annualOutput" name="annualOutput" defaultValue={values.annualOutput} placeholder="5M units / year" />
          </div>
          <div>
            <Label htmlFor="productionCapacity">Production capacity</Label>
            <Input id="productionCapacity" name="productionCapacity" defaultValue={values.productionCapacity} placeholder="20,000 units / month" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={values.city} placeholder="Shenzhen" />
          </div>
          <div>
            <Label htmlFor="province">Province / State</Label>
            <Input id="province" name="province" defaultValue={values.province} placeholder="Guangdong" />
          </div>
          <div>
            <Label htmlFor="country">Country (ISO-2)</Label>
            <Input id="country" name="country" maxLength={2} defaultValue={values.country} placeholder="CN" />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={values.address} placeholder="Building 4, Industrial Park…" />
        </div>

        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        )}
      </fieldset>

      {readOnly && (
        <p className="text-sm text-neutral-500">Your role can view but not edit this profile.</p>
      )}
      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
