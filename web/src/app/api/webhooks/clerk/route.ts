import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Clerk → DB user sync. Clerk owns identity; this keeps our `User` mirror in step
 * so memberships/audit can FK to a stable id (our `User.id` === Clerk user id).
 *
 * Verified with the Svix signature; an unverified payload is rejected (400).
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 500 });

  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const body = await req.text();
  let evt: WebhookEvent;
  try {
    evt = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url } =
        evt.data;
      const email =
        email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
        email_addresses[0]?.email_address;
      if (!email) break;

      await db.user.upsert({
        where: { id },
        create: {
          id,
          email: email.toLowerCase(),
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          imageUrl: image_url ?? null,
        },
        update: {
          email: email.toLowerCase(),
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          imageUrl: image_url ?? null,
        },
      });
      break;
    }
    case "user.deleted": {
      // Memberships cascade; audit rows keep null actor (SetNull) so history survives.
      if (evt.data.id) {
        await db.user.deleteMany({ where: { id: evt.data.id } });
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
