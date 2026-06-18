import Link from "next/link";
import type { Prisma, VerificationStatus } from "@prisma/client";
import { getActiveContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, Input, Label, Select, VerificationBadge } from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";

const VERIFICATION_VALUES: VerificationStatus[] = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"];

type SearchParams = Promise<{ q?: string; category?: string; country?: string; verification?: string }>;

export default async function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  // Auth is guaranteed by the dashboard layout; reading context keeps this gated.
  await getActiveContext();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const country = (sp.country ?? "").trim().toUpperCase().slice(0, 2);
  const verification = VERIFICATION_VALUES.includes(sp.verification as VerificationStatus)
    ? (sp.verification as VerificationStatus)
    : "";

  const where: Prisma.ManufacturerWhereInput = {};
  if (country) where.country = country;
  if (verification) where.verification = verification;
  if (category) where.categories = { some: { categoryId: category } };
  if (q) {
    where.OR = [
      { factoryName: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [suppliers, categories] = await Promise.all([
    db.manufacturer.findMany({
      where,
      include: {
        company: { select: { name: true } },
        categories: { include: { category: { select: { name: true } } } },
      },
      orderBy: [{ verification: "desc" }, { updatedAt: "desc" }],
      take: 60,
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Suppliers</h1>

      <Card>
        <CardContent>
          <form method="get" className="grid items-end gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Name or keyword" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue={category}>
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="country">Country (ISO-2)</Label>
              <Input id="country" name="country" maxLength={2} defaultValue={country} placeholder="CN" />
            </div>
            <div>
              <Label htmlFor="verification">Verification</Label>
              <Select id="verification" name="verification" defaultValue={verification}>
                <option value="">Any</option>
                {VERIFICATION_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-5">
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                Apply filters
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">No suppliers match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {suppliers.map((s) => (
            <Link key={s.id} href={`/dashboard/suppliers/${s.id}`}>
              <Card className="h-full transition-colors hover:border-brand">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.factoryName || s.company.name}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {s.company.name}
                        {s.country ? ` · ${s.country}` : ""}
                        {s.city ? ` · ${s.city}` : ""}
                      </p>
                    </div>
                    <VerificationBadge status={s.verification} />
                  </div>
                  {s.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.categories.slice(0, 4).map((mc) => (
                        <span key={mc.categoryId} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                          {mc.category.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
