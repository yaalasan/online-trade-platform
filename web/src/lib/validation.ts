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

// ---------------------------------------------------------------------------
// RFQ (Request For Quotation)
// ---------------------------------------------------------------------------

export const rfqStatusEnum = z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);

/** Empty/whitespace-only form values normalize to `undefined` for optional fields. */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const createRfqSchema = z.object({
  title: z.string().min(3, "Title is too short").max(160),
  description: z.string().min(10, "Add a more detailed description").max(5000),
  category: z.string().max(80).optional().or(z.literal("")),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),
  unit: z.string().min(1, "Unit is required").max(24),
  targetPrice: z.preprocess(
    blankToUndefined,
    z.coerce.number().positive("Target price must be greater than zero").optional(),
  ),
  currency: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : undefined),
    z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD").optional(),
  ),
  incoterm: z.string().max(12).optional().or(z.literal("")),
  destinationCountry: z.string().length(2).optional().or(z.literal("")),
  needBy: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  status: rfqStatusEnum.default("OPEN"),
});

export const updateRfqSchema = createRfqSchema.extend({
  id: z.string().min(1),
});

export const rfqIdSchema = z.object({
  id: z.string().min(1),
});

export type CreateRfqInput = z.infer<typeof createRfqSchema>;
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>;

// ---------------------------------------------------------------------------
// Manufacturer / supplier profile (Phase 2)
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

export const manufacturerProfileSchema = z.object({
  factoryName: z.string().max(160).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  yearEstablished: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1800, "Year looks too early")
      .max(CURRENT_YEAR, "Year cannot be in the future")
      .optional(),
  ),
  employeeCount: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive("Must be greater than zero").max(10_000_000).optional(),
  ),
  annualOutput: z.string().max(120).optional().or(z.literal("")),
  productionCapacity: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  province: z.string().max(120).optional().or(z.literal("")),
  country: z.string().length(2).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
});

export const setCategoriesSchema = z.object({
  categoryIds: z.array(z.string().min(1)).max(20, "Pick at most 20 categories"),
});

export const certificationSchema = z.object({
  name: z.string().min(2, "Certification name is too short").max(120),
  issuer: z.string().max(120).optional().or(z.literal("")),
  certificateNo: z.string().max(120).optional().or(z.literal("")),
  issuedAt: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  expiresAt: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  documentUrl: z.string().url().optional().or(z.literal("")),
});

export const mediaTypeEnum = z.enum(["FACTORY_PHOTO", "LOGO", "CERTIFICATE", "OTHER"]);

export const mediaMetaSchema = z.object({
  type: mediaTypeEnum.default("FACTORY_PHOTO"),
  caption: z.string().max(200).optional().or(z.literal("")),
});

export const idSchema = z.object({ id: z.string().min(1) });

export type ManufacturerProfileInput = z.infer<typeof manufacturerProfileSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;

// ---------------------------------------------------------------------------
// Product catalog (Phase 3)
// ---------------------------------------------------------------------------

const optionalCurrency = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : undefined),
  z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD").optional(),
);

export const productStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

/** A single specification row. */
export const productSpecSchema = z.object({
  name: z.string().min(1).max(80),
  value: z.string().min(1).max(200),
});

export const createProductSchema = z
  .object({
    name: z.string().min(2, "Name is too short").max(200),
    description: z.string().max(5000).optional().or(z.literal("")),
    moq: z.coerce
      .number({ invalid_type_error: "MOQ must be a number" })
      .int("MOQ must be a whole number")
      .positive("MOQ must be greater than zero"),
    unit: z.string().min(1, "Unit is required").max(24),
    leadTimeDays: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().positive("Lead time must be greater than zero").max(3650).optional(),
    ),
    priceMin: z.preprocess(
      blankToUndefined,
      z.coerce.number().positive("Price must be greater than zero").optional(),
    ),
    priceMax: z.preprocess(
      blankToUndefined,
      z.coerce.number().positive("Price must be greater than zero").optional(),
    ),
    currency: optionalCurrency,
    status: productStatusEnum.default("DRAFT"),
  })
  .refine(
    (d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMax >= d.priceMin,
    { message: "Max price must be ≥ min price", path: ["priceMax"] },
  );

export const updateProductSchema = z.object({ id: z.string().min(1) }).and(createProductSchema);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ProductSpec = z.infer<typeof productSpecSchema>;

// ---------------------------------------------------------------------------
// Inquiries / brokered introductions
// ---------------------------------------------------------------------------

export const inquiryKindEnum = z.enum(["SUPPLIER", "PRODUCT", "RFQ", "GENERAL"]);
export const inquiryStatusEnum = z.enum(["NEW", "IN_REVIEW", "INTRODUCED", "CLOSED"]);

export const createInquirySchema = z.object({
  kind: inquiryKindEnum.default("GENERAL"),
  message: z.string().min(10, "Tell us a bit more about what you need").max(3000),
  targetManufacturerId: z.string().optional().or(z.literal("")),
  targetProductId: z.string().optional().or(z.literal("")),
  rfqId: z.string().optional().or(z.literal("")),
});

export const updateInquirySchema = z.object({
  id: z.string().min(1),
  status: inquiryStatusEnum,
  brokerNotes: z.string().max(5000).optional().or(z.literal("")),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

// ---------------------------------------------------------------------------
// KYB verification
// ---------------------------------------------------------------------------

export const verificationDocTypeEnum = z.enum([
  "BUSINESS_LICENSE",
  "TAX_CERTIFICATE",
  "ISO_CERTIFICATE",
  "ID_DOCUMENT",
  "OTHER",
]);

export const verificationCaseSchema = z.object({
  legalName: z.string().max(200).optional().or(z.literal("")),
  registrationNumber: z.string().max(120).optional().or(z.literal("")),
  registeredCountry: z.string().length(2).optional().or(z.literal("")),
  registeredAddress: z.string().max(300).optional().or(z.literal("")),
});

/** Admin review decision. UNDER_REVIEW just claims the case; the others are terminal. */
export const reviewDecisionEnum = z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]);

export const reviewCaseSchema = z
  .object({
    id: z.string().min(1),
    decision: reviewDecisionEnum,
    reviewNotes: z.string().max(5000).optional().or(z.literal("")),
  })
  .refine((d) => d.decision !== "REJECTED" || (d.reviewNotes && d.reviewNotes.trim().length > 0), {
    message: "A rejection reason is required",
    path: ["reviewNotes"],
  });

export type VerificationCaseInput = z.infer<typeof verificationCaseSchema>;
