import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const FLASK_BASE = process.env.FLASK_API_URL ?? "https://fastflow.global";

// Flask marketplace uses integer IDs; portal products use cuid() strings.
const isPortalId = (id: string) => !/^\d+$/.test(id);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Honeypot: bots fill this; humans don't.
  if (body.website) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const company = String(body.company ?? "").trim();
  const quantity = String(body.quantity ?? "").trim();

  if (!name || !email || message.length < 20) {
    return NextResponse.json({ error: "name, email, and message (min 20 chars) are required." }, { status: 400 });
  }

  if (isPortalId(id)) {
    // Portal product: verify it exists, then write to Postgres.
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    await db.inquiry.create({
      data: {
        targetProductId: id,
        message,
        contactName: name,
        contactEmail: email,
        contactCompany: company || null,
        quantity: quantity || null,
        kind: "PRODUCT",
      },
    });
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Flask marketplace product: proxy to Flask.
  let upstream: Response;
  try {
    upstream = await fetch(`${FLASK_BASE}/api/products/${encodeURIComponent(id)}/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the inquiry service." }, { status: 502 });
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
