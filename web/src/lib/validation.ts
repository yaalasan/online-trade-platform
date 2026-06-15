import { z } from "zod";

export const companyTypeEnum = z.enum(["MANUFACTURER", "BUYER", "BOTH"]);
export const assignableRoleEnum = z.enum(["ADMIN", "MANAGER", "MEMBER"]); // OWNER not assignable via invite/update

export const createCompanySchema = z.object({
  name: z.string().min(2, "Name is too short").max(120),
  type: companyTypeEnum.default("MANUFACTURER"),
  country: z.string().length(2).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(120),
  type: companyTypeEnum,
  country: z.string().length(2).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: assignableRoleEnum.default("MEMBER"),
});

export const updateRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: assignableRoleEnum,
});

export const membershipIdSchema = z.object({
  membershipId: z.string().min(1),
});

export const companyIdSchema = z.object({
  companyId: z.string().min(1),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
