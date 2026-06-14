// Public contact endpoint — forwards landing-page enquiries to the n8n webhook server-side
// (avoids browser CORS, keeps the webhook URL off the client, lets us add light validation).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK = process.env.CONTACT_WEBHOOK_URL || "https://n8n.iautomatedev.com/webhook/vantage-contact-us";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const company = String(body.company ?? "").trim();
  if (!name || !email || !company || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "missing required fields" }, { status: 422 });
  }

  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, name, email, company, forwardedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `webhook ${res.status}` }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "webhook unreachable" }, { status: 502 });
  }
}
