"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVerificationCase } from "@/server/verification";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export type VerificationCaseValues = {
  legalName: string;
  registrationNumber: string;
  registeredCountry: string;
  registeredAddress: string;
};

export function VerificationCaseForm({
  values,
  readOnly,
}: {
  values: VerificationCaseValues;
  readOnly: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await saveVerificationCase(formData);
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
          <Label htmlFor="legalName">{t("verificationForm.legalName")}</Label>
          <Input id="legalName" name="legalName" defaultValue={values.legalName} placeholder={t("verificationForm.legalNamePlaceholder")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="registrationNumber">{t("verificationForm.regNumber")}</Label>
            <Input id="registrationNumber" name="registrationNumber" defaultValue={values.registrationNumber} placeholder="91440300MA5…" />
          </div>
          <div>
            <Label htmlFor="registeredCountry">{t("suppliers.country")}</Label>
            <Input id="registeredCountry" name="registeredCountry" maxLength={2} defaultValue={values.registeredCountry} placeholder="CN" />
          </div>
        </div>
        <div>
          <Label htmlFor="registeredAddress">{t("verificationForm.regAddress")}</Label>
          <Textarea id="registeredAddress" name="registeredAddress" rows={2} defaultValue={values.registeredAddress} />
        </div>
        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("verificationForm.saveDetails")}
          </Button>
        )}
      </fieldset>
      {readOnly && (
        <p className="text-sm text-neutral-500">{t("verificationForm.lockedNote")}</p>
      )}
      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
