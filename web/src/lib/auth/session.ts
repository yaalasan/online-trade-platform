import { cache } from "react";
import { headers } from "next/headers";
import type { Company, Membership, MembershipRole, User } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/server";

/**
 * Resolve the current better-auth session and return the logged-in user id, or
 * null if signed out. `cache()` dedupes the session lookup within a request.
 */
const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
});

/**
 * No-op retained for call sites at authenticated entry points.
 *
 * With self-hosted auth the `User` row is created by better-auth at sign-up
 * (and platformRole/firstName are populated by its create hook in
 * `@/lib/auth/server`), so there is no external IdP to lazily mirror. Kept as a
 * stable seam in case future bootstrap logic is needed.
 */
export async function ensureUserSynced(): Promise<void> {
  return;
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
  const userId = await getSessionUserId();
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
