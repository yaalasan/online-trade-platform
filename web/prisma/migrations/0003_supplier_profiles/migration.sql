-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('FACTORY_PHOTO', 'LOGO', 'CERTIFICATE', 'OTHER');

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "factoryName" TEXT,
    "description" TEXT,
    "yearEstablished" INTEGER,
    "employeeCount" INTEGER,
    "annualOutput" TEXT,
    "productionCapacity" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "address" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturerCategory" (
    "manufacturerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ManufacturerCategory_pkey" PRIMARY KEY ("manufacturerId", "categoryId")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "certificateNo" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL DEFAULT 'FACTORY_PHOTO',
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_companyId_key" ON "Manufacturer"("companyId");

-- CreateIndex
CREATE INDEX "Manufacturer_verification_idx" ON "Manufacturer"("verification");

-- CreateIndex
CREATE INDEX "Manufacturer_country_idx" ON "Manufacturer"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "ManufacturerCategory_categoryId_idx" ON "ManufacturerCategory"("categoryId");

-- CreateIndex
CREATE INDEX "Certification_manufacturerId_idx" ON "Certification"("manufacturerId");

-- CreateIndex
CREATE INDEX "MediaAsset_manufacturerId_type_idx" ON "MediaAsset"("manufacturerId", "type");

-- AddForeignKey
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturerCategory" ADD CONSTRAINT "ManufacturerCategory_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturerCategory" ADD CONSTRAINT "ManufacturerCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: starter category taxonomy (platform-curated, idempotent).
INSERT INTO "Category" ("id", "name", "slug") VALUES
    ('cat_electronics', 'Electronics', 'electronics'),
    ('cat_machinery', 'Machinery', 'machinery'),
    ('cat_textiles', 'Textiles & Apparel', 'textiles-apparel'),
    ('cat_construction', 'Construction & Building', 'construction-building'),
    ('cat_packaging', 'Packaging & Printing', 'packaging-printing'),
    ('cat_home', 'Home & Garden', 'home-garden'),
    ('cat_auto', 'Auto & Transportation', 'auto-transportation'),
    ('cat_chemicals', 'Chemicals & Materials', 'chemicals-materials'),
    ('cat_health', 'Health & Beauty', 'health-beauty'),
    ('cat_food', 'Food & Beverage', 'food-beverage'),
    ('cat_metals', 'Metals & Alloys', 'metals-alloys'),
    ('cat_lighting', 'Lighting', 'lighting')
ON CONFLICT ("slug") DO NOTHING;
