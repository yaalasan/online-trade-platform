"use server";

import { revalidatePath } from "next/cache";
import type { MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/rbac";
import { outranks } from "@/lib/auth/permissions";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { inviteMemberSchema, updateRoleSchema, membershipIdSchema } from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";

/**
 * Add an existing registered user to the ACTIVE company by email.
 * (Foundation scope: email-invitation flow for not-yet-registered users is a
 * follow-up; here the invitee must already have a synced account.)
 */
export async function inviteMember(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requirePermission("member:invite");

    const parsed = inviteMemberSchema.safeParse({
      email: formData.get("email"),
      role: formData.get("role") || "MEMBER",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { email, role } = parsed.data;

    // A non-owner cannot grant a role at/above their own authority.
    if (!outranks(ctx.role, role as MembershipRole)) {
      throw new AuthorizationError(`You cannot assign the role ${role}.`);
    }

    const invitee = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!invitee) {
      throw new NotFoundError("No registered user with that email. Ask them to sign up first.");
    }

    const existing = await db.membership.findUnique({
      where: { userId_companyId: { userId: invitee.id, companyId: ctx.company.id } },
    });
    if (existing) throw new ValidationError("That user is already a member.");

    await db.$transaction(async (tx) => {
      const m = await tx.membership.create({
        data: { userId: invitee.id, companyId: ctx.company.id, role: role as MembershipRole },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "member.invited",
          metadata: { membershipId: m.id, inviteeId: invitee.id, role },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/members");
  });
}

/** Change a member's role within the active company. */
export async function updateMemberRole(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requirePermission("member:update_role");

    const parsed = updateRoleSchema.safeParse({
      membershipId: formData.get("membershipId"),
      role: formData.get("role"),
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { membershipId, role } = parsed.data;

    const target = await db.membership.findUnique({ where: { id: membershipId } });
    // Membership must belong to the ACTIVE company — blocks cross-company tampering.
    if (!target || target.companyId !== ctx.company.id) {
      throw new NotFoundError("Member not found in this company.");
    }
    if (target.userId === ctx.user.id) {
      throw new AuthorizationError("You cannot change your own role.");
    }
    // Cannot act on a peer or someone above you (e.g. admin touching an owner).
    if (!outranks(ctx.role, target.role)) {
      throw new AuthorizationError("You cannot modify a member at or above your role.");
    }
    // Cannot promote someone to/above your own authority.
    if (!outranks(ctx.role, role as MembershipRole)) {
      throw new AuthorizationError(`You cannot assign the role ${role}.`);
    }

    await db.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: membershipId }, data: { role: role as MembershipRole } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "member.role_updated",
          metadata: { membershipId, from: target.role, to: role },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/members");
  });
}

/** Remove a member from the active company. Protects the last owner. */
export async function removeMember(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requirePermission("member:remove");

    const parsed = membershipIdSchema.safeParse({ membershipId: formData.get("membershipId") });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const { membershipId } = parsed.data;

    const target = await db.membership.findUnique({ where: { id: membershipId } });
    if (!target || target.companyId !== ctx.company.id) {
      throw new NotFoundError("Member not found in this company.");
    }
    if (target.userId === ctx.user.id) {
      throw new AuthorizationError("You cannot remove yourself. Transfer ownership or leave instead.");
    }
    if (!outranks(ctx.role, target.role)) {
      throw new AuthorizationError("You cannot remove a member at or above your role.");
    }
    if (target.role === "OWNER") {
      const owners = await db.membership.count({
        where: { companyId: ctx.company.id, role: "OWNER" },
      });
      if (owners <= 1) throw new AuthorizationError("Cannot remove the last owner.");
    }

    await db.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: membershipId } });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "member.removed",
          metadata: { membershipId, removedUserId: target.userId, role: target.role },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/members");
  });
}
