import { getCurrentUser, type UserWithMemberships } from "@/lib/auth/session";
import { AuthorizationError, UnauthenticatedError } from "@/lib/errors";

/**
 * Cross-tenant SinoSource staff gates, orthogonal to the per-company RBAC. These
 * never read a client-supplied flag — `platformRole` is server state on the synced
 * user row, granted out-of-band.
 */

/** The current user if they are SinoSource staff (STAFF or ADMIN), else null. */
export async function getPlatformUser(): Promise<UserWithMemberships | null> {
  const user = await getCurrentUser();
  return user && user.platformRole !== "NONE" ? user : null;
}

/** Require SinoSource staff (broker queue). */
export async function requirePlatformStaff(): Promise<UserWithMemberships> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (user.platformRole === "NONE") throw new AuthorizationError("SinoSource staff only.");
  return user;
}

/** Require a SinoSource admin (e.g. KYB approval). */
export async function requirePlatformAdmin(): Promise<UserWithMemberships> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (user.platformRole !== "ADMIN") throw new AuthorizationError("SinoSource admin only.");
  return user;
}
