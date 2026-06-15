import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, VerificationBadge } from "@/components/ui/primitives";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await getActiveContext(); // gated by layout; keeps the route authenticated
  const { id } = await params;

  const s = await db.manufacturer.findUnique({
    where: { id },
    include: {
      company: true,
      categories: { include: { category: { select: { name: true } } } },
      certifications: { orderBy: { createdAt: "desc" } },
      media: { orderBy: { createdAt: "desc" } },
      products: {
        where: { status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      },
    },
  });
  if (!s) notFound();

  const photos = s.media.filter((m) => m.contentType?.startsWith("image/"));
  const docs = s.media.filter((m) => !m.contentType?.startsWith("image/"));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/suppliers" className="text-sm text-neutral-500 hover:text-brand">
          ← Back to suppliers
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{s.factoryName || s.company.name}</h1>
          <VerificationBadge status={s.verification} />
        </div>
        <p className="text-sm text-neutral-500">
          {s.company.name}
          {s.country ? ` · ${s.country}` : ""}
          {s.city ? ` · ${s.city}` : ""}
          {s.province ? `, ${s.province}` : ""}
        </p>
      </div>

      {s.description && (
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-neutral-800">{s.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Factory information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Year established" value={s.yearEstablished?.toString() ?? "—"} />
          <Detail label="Employees" value={s.employeeCount?.toLocaleString() ?? "—"} />
          <Detail label="Annual output" value={s.annualOutput ?? "—"} />
          <Detail label="Production capacity" value={s.productionCapacity ?? "—"} />
          <Detail label="Address" value={s.address ?? "—"} />
          <Detail
            label="Categories"
            value={s.categories.map((c) => c.category.name).join(", ") || "—"}
          />
        </CardContent>
      </Card>

      {s.products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {s.products.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/catalog/${p.id}`}
                  className="overflow-hidden rounded-md border border-neutral-200 transition-colors hover:border-brand"
                >
                  <div className="flex h-24 items-center justify-center bg-neutral-50">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0].url} alt={p.images[0].alt ?? p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-neutral-400">No image</span>
                    )}
                  </div>
                  <p className="truncate p-2 text-xs font-medium">{p.name}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {s.certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-neutral-100">
              {s.certifications.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-neutral-500">
                    {c.issuer ? ` · ${c.issuer}` : ""}
                    {c.expiresAt ? ` · expires ${c.expiresAt.toLocaleDateString()}` : ""}
                  </span>
                  {c.documentUrl && (
                    <>
                      {" · "}
                      <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        document
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Factory photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((m) => (
                <figure key={m.id} className="overflow-hidden rounded-md border border-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.caption ?? "factory photo"} className="h-32 w-full object-cover" />
                  {m.caption && <figcaption className="p-2 text-xs text-neutral-600">{m.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {docs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {docs.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block text-sm text-brand hover:underline">
                {m.caption || m.fileName || "Document"}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="whitespace-pre-wrap text-neutral-800">{value}</p>
    </div>
  );
}
