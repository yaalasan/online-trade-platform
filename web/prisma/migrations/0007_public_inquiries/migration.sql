-- Public sourcing leads: an Inquiry can now originate from an anonymous storefront
-- visitor. Make the requesting company optional and add self-reported buyer fields.

-- AlterTable
ALTER TABLE "Inquiry" ALTER COLUMN "companyId" DROP NOT NULL;

ALTER TABLE "Inquiry" ADD COLUMN "quantity" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "contactCompany" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "contactCountry" TEXT;
