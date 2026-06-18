"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRfq, updateRfq } from "@/server/rfqs";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";

export type RfqFormValues = {
  title: string;
  description: string;
  category: string;
  quantity: string;
  unit: string;
  targetPrice: string;
  currency: string;
  incoterm: string;
  destinationCountry: string;
  needBy: string; // yyyy-mm-dd
  status: string;
};

const EMPTY: RfqFormValues = {
  title: "",
  description: "",
  category: "",
  quantity: "",
  unit: "pcs",
  targetPrice: "",
  currency: "",
  incoterm: "",
  destinationCountry: "",
  needBy: "",
  status: "OPEN",
};

const STATUSES = ["DRAFT", "OPEN", "CLOSED", "CANCELLED"] as const;

/**
 * Create form when `rfqId` is omitted, edit form when it is provided.
 * On success: create → navigate to the new RFQ; edit → refresh in place.
 */
export function RfqForm({ rfqId, defaults }: { rfqId?: string; defaults?: RfqFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const values = defaults ?? EMPTY;
  const isEdit = Boolean(rfqId);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      if (isEdit) {
        formData.set("id", rfqId as string);
        const res = await updateRfq(formData);
        if (res.ok) {
          setMsg({ kind: "ok", text: "Saved." });
          router.refresh();
        } else {
          setMsg({ kind: "err", text: res.error });
        }
      } else {
        const res = await createRfq(formData);
        if (res.ok) router.push(`/dashboard/rfqs/${res.data.rfqId}`);
        else setMsg({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={values.title} placeholder="500t cold-rolled steel coil" />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            required
            defaultValue={values.description}
            placeholder="Specs, tolerances, certifications, packaging…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" defaultValue={values.category} placeholder="Raw materials" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={values.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={values.quantity}
              placeholder="500"
            />
          </div>
          <div>
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" name="unit" required defaultValue={values.unit} placeholder="pcs / kg / m" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="targetPrice">Target price / unit</Label>
            <Input
              id="targetPrice"
              name="targetPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={values.targetPrice}
              placeholder="Indicative budget (optional)"
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency (ISO-3)</Label>
            <Input id="currency" name="currency" maxLength={3} defaultValue={values.currency} placeholder="USD" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="incoterm">Incoterm</Label>
            <Input id="incoterm" name="incoterm" maxLength={12} defaultValue={values.incoterm} placeholder="FOB" />
          </div>
          <div>
            <Label htmlFor="destinationCountry">Destination (ISO-2)</Label>
            <Input
              id="destinationCountry"
              name="destinationCountry"
              maxLength={2}
              defaultValue={values.destinationCountry}
              placeholder="DE"
            />
          </div>
          <div>
            <Label htmlFor="needBy">Need by</Label>
            <Input id="needBy" name="needBy" type="date" defaultValue={values.needBy} />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create RFQ"}
        </Button>
      </fieldset>

      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
