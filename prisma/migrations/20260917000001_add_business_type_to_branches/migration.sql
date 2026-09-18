-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('CAFETERIA', 'RESTAURANTE', 'PANADERIA', 'COMIDA_RAPIDA', 'OTRO');

-- AlterTable: add nullable column first so existing rows can be backfilled
ALTER TABLE "branches" ADD COLUMN "businessType" "BusinessType";

-- Backfill existing branches
UPDATE "branches" SET "businessType" = 'OTRO' WHERE "businessType" IS NULL;

-- Enforce NOT NULL (no branch is left with a null business type)
ALTER TABLE "branches" ALTER COLUMN "businessType" SET NOT NULL;