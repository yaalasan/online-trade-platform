import { NextRequest, NextResponse } from "next/server";

const FLASK_BASE = process.env.FLASK_API_URL ?? "https://fastflow.global";

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

  // Honeypot: if the website field is filled the request is from a bot.
  if (body.website) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Proxy to Flask, which performs full validation, rate-limiting, and persistence.
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
