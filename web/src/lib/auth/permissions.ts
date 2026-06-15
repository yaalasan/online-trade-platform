import type { MembershipRole } from "@prisma/client";

/**
 * Permission catalog. Format `<resource>:<action>`.
 * The set is intentionally small for the foundation phase.
 */
export type Permission =
  | "company:read"
  | "company:update"
  | "company:delete"
  | "member:read"
  | "member:invite"
  | "member:update_role"
  | "member:remove"
  | "audit:read";

/**
 * Role → permission grants. This is the single source of truth for coarse RBAC.
 * Fine-grained constraints that depend on the *target* (e.g. "an admin cannot
 * change an owner's role") are enforced additionally in the server actions using
 * `roleRank` below — permissions alone are necessary, not sufficient.
 */
export const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  OWNER: [
    "company:read",
    "company:update",
    "company:delete",
    "member:read",
    "member:invite",
    "member:update_role",
    "member:remove",
    "audit:read",
  ],
  ADMIN: [
    "company:read",
    "company:update",
    "member:read",
    "member:invite",
    "member:update_role",
    "member:remove",
    "audit:read",
  ],
  MANAGER: ["company:read", "member:read", "member:invite"],
  MEMBER: ["company:read", "member:read"],
};

/** Higher number = more authority. Used for "cannot act on a peer/superior" checks. */
export const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  MEMBER: 1,
};

export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** True if `actor` outranks `target` (strictly). Owners outrank everyone but peers. */
export function outranks(actor: MembershipRole, target: MembershipRole): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
