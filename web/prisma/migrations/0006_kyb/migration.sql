-- CreateEnum
CREATE TYPE "VerificationCaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationDocType" AS ENUM ('BUSINESS_LICENSE', 'TAX_CERTIFICATE', 'ISO_CERTIFICATE', 'ID_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "VerificationCase" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "status" "VerificationCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "legalName" TEXT,
    "registrationNumber" TEXT,
    "registeredCountry" TEXT,
    "registeredAddress" TEXT,
    "submittedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "VerificationDocType" NOT NULL DEFAULT 'BUSINESS_LICENSE',
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationCase_status_createdAt_idx" ON "VerificationCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCase_manufacturerId_createdAt_idx" ON "VerificationCase"("manufacturerId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationDocument_caseId_idx" ON "VerificationDocument"("caseId");

-- AddForeignKey
ALTER TABLE "VerificationCase" ADD CONSTRAINT "VerificationCase_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCase" ADD CONSTRAINT "VerificationCase_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCase" ADD CONSTRAINT "VerificationCase_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VerificationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
