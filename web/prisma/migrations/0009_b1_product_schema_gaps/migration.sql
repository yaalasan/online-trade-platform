-- B1: add packaging inline columns + variant/priceTier/descriptionBlock/faq tables

-- Packaging inline columns on Product
ALTER TABLE "Product" ADD COLUMN "packageSize" TEXT;
ALTER TABLE "Product" ADD COLUMN "grossWeight" TEXT;
ALTER TABLE "Product" ADD COLUMN "port"        TEXT;

-- ProductVariant
CREATE TABLE "ProductVariant" (
    "id"        TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "options"   JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductVariant_productId_sortOrder_idx" ON "ProductVariant"("productId", "sortOrder");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProductPriceTier
CREATE TABLE "ProductPriceTier" (
    "id"        TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty"    INTEGER NOT NULL,
    "maxQty"    INTEGER,
    "price"     DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPriceTier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductPriceTier_productId_sortOrder_idx" ON "ProductPriceTier"("productId", "sortOrder");
ALTER TABLE "ProductPriceTier" ADD CONSTRAINT "ProductPriceTier_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProductDescriptionBlock
CREATE TABLE "ProductDescriptionBlock" (
    "id"        TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "content"   JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductDescriptionBlock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductDescriptionBlock_productId_sortOrder_idx" ON "ProductDescriptionBlock"("productId", "sortOrder");
ALTER TABLE "ProductDescriptionBlock" ADD CONSTRAINT "ProductDescriptionBlock_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProductFaq
CREATE TABLE "ProductFaq" (
    "id"        TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "question"  TEXT NOT NULL,
    "answer"    TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductFaq_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductFaq_productId_sortOrder_idx" ON "ProductFaq"("productId", "sortOrder");
ALTER TABLE "ProductFaq" ADD CONSTRAINT "ProductFaq_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
