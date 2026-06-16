import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Company, Membership, MembershipRole, User } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Bootstrap allowlist for SinoSource staff. Emails here are granted ADMIN
 * platformRole on first sync, so a fresh deployment has an admin without manual
 * DB edits. Already-synced users are granted via the staff admin path, not here.
 */
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Safety net for the Clerk → DB sync. The webhook is the primary path, but a user
 * can land on the app a beat before it fires. Call this at the top of authenticated
 * entry points (before any getCurrentUser) to lazily upsert the mirror row.
 * Idempotent and cheap (one indexed lookup when already synced).
 */
export async function ensureUserSynced(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const existing = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (existing) return;

  const cu = await currentUser();
  if (!cu) return;
  const email =
    cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress;
  if (!email) return;

  const platformRole = PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase()) ? "ADMIN" : "NONE";

  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: email.toLowerCase(),
      firstName: cu.firstName,
      lastName: cu.lastName,
      imageUrl: cu.imageUrl,
      platformRole,
    },
    update: {},
  });
}

export type MembershipWithCompany = Membership & { company: Company };

export type UserWithMemberships = User & {
  memberships: MembershipWithCompany[];
};

/**
 * The fully-resolved, server-trusted context for the current request.
 * `company`/`membership` are the ACTIVE company — derived server-side from the DB,
 * never from a client-supplied id.
 */
export type ActiveContext = {
  user: UserWithMemberships;
  membership: MembershipWithCompany;
  company: Company;
  role: MembershipRole;
};

/**
 * The current synced user (mirror of the Clerk identity), or null if signed out
 * or not yet synced. `cache()` dedupes within a single request.
 */
export const getCurrentUser = cache(async (): Promise<UserWithMemberships | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  return db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { company: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
});

/**
 * Resolve the ACTIVE company context.
 *
 * Security-critical: the active company is taken from `user.activeCompanyId`
 * (server state) and then **validated** against the user's actual memberships.
 * If it is null or stale, we fall back to the earliest membership. A client can
 * never select a company it isn't a member of — there is no client-supplied id here.
 *
 * Returns null when the user has no memberships yet (→ onboarding).
 */
export const getActiveContext = cache(async (): Promise<ActiveContext | null> => {
  const user = await getCurrentUser();
  if (!user || user.memberships.length === 0) return null;

  const selected =
    (user.activeCompanyId &&
      user.memberships.find((m) => m.companyId === user.activeCompanyId)) ||
    user.memberships[0];

  return {
    user,
    membership: selected,
    company: selected.company,
    role: selected.role,
  };
});
