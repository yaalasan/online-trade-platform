"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { UnauthenticatedError, ValidationError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/auth/session";
import { requirePermission, requireActiveContext } from "@/lib/auth/rbac";
import { createCompanySchema, updateCompanySchema } from "@/lib/validation";
import { run, type ActionResult } from "@/server/action-result";

/**
 * Create a company. Any signed-in user may create one; they become its OWNER,
 * and it is set as their active company. This is the bootstrap that gives a brand
 * new user (with zero memberships) their first context.
 */
export async function createCompany(formData: FormData): Promise<ActionResult<{ companyId: string }>> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UnauthenticatedError();

    const parsed = createCompanySchema.safeParse({
      name: formData.get("name"),
      type: formData.get("type") || "MANUFACTURER",
      country: formData.get("country") || "",
      website: formData.get("website") || "",
      description: formData.get("description") || "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const input = parsed.data;

    const company = await db.$transaction(async (tx) => {
      // Unique-ish slug.
      const base = slugify(input.name) || "company";
      let slug = base;
      for (let i = 1; await tx.company.findUnique({ where: { slug } }); i++) {
        slug = `${base}-${i}`;
      }

      const company = await tx.company.create({
        data: {
          name: input.name,
          slug,
          type: input.type,
          country: input.country || null,
          website: input.website || null,
          description: input.description || null,
        },
      });

      await tx.membership.create({
        data: { userId: user.id, companyId: company.id, role: "OWNER" },
      });

      // Make it the active company for the creator.
      await tx.user.update({
        where: { id: user.id },
        data: { activeCompanyId: company.id },
      });

      await logAudit(
        {
          userId: user.id,
          companyId: company.id,
          action: "company.created",
          metadata: { name: company.name, type: company.type },
        },
        tx,
      );

      return company;
    });

    revalidatePath("/dashboard");
    return { companyId: company.id };
  });
}

/** Update the ACTIVE company's profile. Scope comes from the active membership, not args. */
export async function updateCompany(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requirePermission("company:update");

    const parsed = updateCompanySchema.safeParse({
      name: formData.get("name"),
      type: formData.get("type"),
      country: formData.get("country") || "",
      website: formData.get("website") || "",
      description: formData.get("description") || "",
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);
    const input = parsed.data;

    await db.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: ctx.company.id }, // active company, server-derived
        data: {
          name: input.name,
          type: input.type,
          country: input.country || null,
          website: input.website || null,
          description: input.description || null,
        },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId: ctx.company.id,
          action: "company.updated",
          metadata: { name: input.name, type: input.type },
        },
        tx,
      );
    });

    revalidatePath("/dashboard/settings");
  });
}

/**
 * Switch the active company. This is the ONLY place a client-supplied companyId is
 * accepted — and it is validated against the user's memberships before being persisted.
 */
export async function switchCompany(companyId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireActiveContext();

    const target = ctx.user.memberships.find((m) => m.companyId === companyId);
    if (!target) {
      // Not a member → treat as forbidden; never trust the supplied id.
      throw new ValidationError("You are not a member of that company.");
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ctx.user.id },
        data: { activeCompanyId: companyId },
      });
      await logAudit(
        {
          userId: ctx.user.id,
          companyId,
          action: "company.switched",
          metadata: { from: ctx.company.id, to: companyId },
        },
        tx,
      );
    });

    revalidatePath("/dashboard");
  });
}
