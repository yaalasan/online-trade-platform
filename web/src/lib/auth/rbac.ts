import { AuthorizationError, UnauthenticatedError } from "@/lib/errors";
import { getActiveContext, type ActiveContext } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

/**
 * The one gate every mutating server action must pass through.
 *
 * - Throws `UnauthenticatedError` if there is no signed-in, synced user with an active company.
 * - Throws `AuthorizationError` if the active membership's role lacks `permission`.
 * - Returns the server-trusted `ActiveContext` so callers derive `companyId` from
 *   `ctx.company.id` — NEVER from action arguments.
 *
 * This is the single choke point that makes "every action scoped to active membership"
 * true by construction.
 */
export async function requirePermission(permission: Permission): Promise<ActiveContext> {
  const ctx = await getActiveContext();
  if (!ctx) {
    throw new UnauthenticatedError("You must belong to a company to do this.");
  }
  if (!hasPermission(ctx.role, permission)) {
    throw new AuthorizationError(
      `Your role (${ctx.role}) cannot perform "${permission}".`,
    );
  }
  return ctx;
}

/** Require a signed-in user with an active company, without a specific permission. */
export async function requireActiveContext(): Promise<ActiveContext> {
  const ctx = await getActiveContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}
