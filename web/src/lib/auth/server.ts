import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { sendSms } from "@/lib/sms";

/**
 * Self-hosted identity for Fastflow (replaces Clerk).
 *
 * Everything here runs on our own server + Postgres — no foreign auth provider —
 * so mainland-China suppliers can register and sign in without hitting the Great
 * Firewall. Two login methods:
 *   - email + password (universal, incl. overseas buyers)
 *   - phone + SMS OTP  (the dominant method in China; see src/lib/sms.ts)
 *
 * The user row is the same `User` model the rest of the app FKs to (memberships,
 * audit, RFQs); better-auth owns its lifecycle and we layer platformRole on top.
 */
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "Fastflow",
  // Public origin of the portal, e.g. https://portal.fastflow.global. Used to
  // build callback URLs and to scope the session cookie.
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // KYB/verification is the trust gate, not email confirmation — keep sign-up
    // friction low. Flip on once an email sender is wired.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }) => {
        await sendSms(phone, `【Fastflow】验证码 ${code}，5分钟内有效。Verification code: ${code}`);
      },
      // Allow phone-only registration: verifying an OTP for an unknown number
      // creates the account with a placeholder email (suppliers may not have one).
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/[^0-9]/g, "")}@phone.fastflow.local`,
        getTempName: (phone) => phone,
      },
      expiresIn: 300,
      allowedAttempts: 5,
    }),
    // Must be last: bridges better-auth's Set-Cookie into Next.js server actions.
    nextCookies(),
  ],

  // App-owned columns better-auth must be aware of to read/write the User row.
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      platformRole: { type: "string", required: false, input: false, defaultValue: "NONE" },
      activeCompanyId: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Bootstrap Fastflow staff + keep the legacy firstName column populated
        // (dashboard lists render `firstName ?? email`).
        before: async (user) => {
          const email = (user.email ?? "").toLowerCase();
          const platformRole = PLATFORM_ADMIN_EMAILS.includes(email) ? "ADMIN" : "NONE";
          return {
            data: {
              ...user,
              platformRole,
              firstName: (user as { firstName?: string | null }).firstName ?? user.name ?? null,
            },
          };
        },
      },
    },
  },
});

export type Auth = typeof auth;
