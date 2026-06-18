"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "@/server/companies";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";

export function CreateCompanyForm() {
  const router = useRouter();
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
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" required placeholder="Acme Manufacturing Co." />
      </div>
      <div>
        <Label htmlFor="type">Type</Label>
        <Select id="type" name="type" defaultValue="MANUFACTURER">
          <option value="MANUFACTURER">Manufacturer</option>
          <option value="BUYER">Buyer</option>
          <option value="BOTH">Both</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="country">Country (ISO-2)</Label>
          <Input id="country" name="country" maxLength={2} placeholder="CN" />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" type="url" placeholder="https://…" />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} placeholder="What you make or source." />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create company"}
      </Button>
    </form>
  );
}
