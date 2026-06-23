/**
 * Set (or reset) a user's email+password credential directly in the DB.
 *
 * Use it to bootstrap the platform admin after switching to self-hosted auth, or
 * to reset any account from the server.
 *
 *   node scripts/set-password.mjs <email> <password>
 *
 * The user row must already exist (created via the sign-up form or seeded). The
 * password is hashed with better-auth's own hasher, so the account can then sign
 * in normally via email + password.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/set-password.mjs <email> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`No user with email ${email}. Have them sign up first.`);
    process.exit(1);
  }

  const hash = await hashPassword(password);
  // better-auth's email/password provider stores the hash on a "credential" account.
  const existing = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (existing) {
    await db.account.update({ where: { id: existing.id }, data: { password: hash } });
    console.log(`Updated password for ${email}.`);
  } else {
    await db.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hash,
      },
    });
    console.log(`Created password credential for ${email}.`);
  }
} finally {
  await db.$disconnect();
}
