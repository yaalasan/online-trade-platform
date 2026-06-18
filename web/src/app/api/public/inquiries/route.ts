import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createPublicInquirySchema } from "@/lib/validation";

/**
 * Buyer sourcing request from the Flask site → an anonymous lead in the broker
 * queue (companyId/createdByUserId null). Accepts JSON or form-encoded bodies.
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // Accept either JSON or urlencoded form posts from Flask.
  let raw: Record<string, unknown> = {};
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      raw = (await req.json()) as Record<string, unknown>;
    } else {
      raw = Object.fromEntries((await req.formData()).entries());
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createPublicInquirySchema.safeParse({
    kind: raw.kind ?? "GENERAL",
    productNeeded: raw.productNeeded ?? "",
    quantity: raw.quantity ?? "",
    message: raw.message,
    contactName: raw.contactName,
    contactEmail: raw.contactEmail,
    contactPhone: raw.contactPhone ?? "",
    contactCompany: raw.contactCompany ?? "",
    contactCountry: raw.contactCountry ?? "",
    targetManufacturerId: raw.targetManufacturerId ?? "",
    targetProductId: raw.targetProductId ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const i = parsed.data;

  const targetManufacturerId = i.targetManufacturerId || null;
  const targetProductId = i.targetProductId || null;

  // Drop targets that don't resolve rather than storing dangling references.
  const validManufacturer = targetManufacturerId
    ? await db.manufacturer.findUnique({ where: { id: targetManufacturerId }, select: { id: true } })
    : null;
  const validProduct = targetProductId
    ? await db.product.findFirst({ where: { id: targetProductId, status: "ACTIVE" }, select: { id: true } })
    : null;

  const message = i.productNeeded ? `Looking for: ${i.productNeeded}\n\n${i.message}` : i.message;

  const created = await db.inquiry.create({
    data: {
      companyId: null,
      createdByUserId: null,
      kind: i.kind,
      message,
      quantity: i.quantity || null,
      contactName: i.contactName,
      contactEmail: i.contactEmail.toLowerCase(),
      contactPhone: i.contactPhone || null,
      contactCompany: i.contactCompany || null,
      contactCountry: i.contactCountry || null,
      targetManufacturerId: validManufacturer?.id ?? null,
      targetProductId: validProduct?.id ?? null,
    },
  });

  await logAudit({
    userId: null,
    companyId: null,
    action: "inquiry.public_created",
    metadata: { inquiryId: created.id, source: "flask", email: i.contactEmail.toLowerCase() },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
