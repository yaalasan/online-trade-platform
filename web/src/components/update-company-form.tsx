"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompany } from "@/server/companies";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";

type Company = {
  name: string;
  type: string;
  country: string | null;
  website: string | null;
  description: string | null;
};

export function UpdateCompanyForm({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await updateCompany(formData);
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
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={company.name} required />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={company.type}>
            <option value="MANUFACTURER">Manufacturer</option>
            <option value="BUYER">Buyer</option>
            <option value="BOTH">Both</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="country">Country (ISO-2)</Label>
            <Input id="country" name="country" maxLength={2} defaultValue={company.country ?? ""} />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" type="url" defaultValue={company.website ?? ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={company.description ?? ""} />
        </div>
        {!readOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
      </fieldset>
      {readOnly && (
        <p className="text-sm text-neutral-500">Your role can view but not edit these settings.</p>
      )}
      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
