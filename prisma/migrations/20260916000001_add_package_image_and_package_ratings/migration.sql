-- AlterTable: package image
ALTER TABLE "food_packages" ADD COLUMN "imageUrl" TEXT;

-- AlterTable: per-package ratings
ALTER TABLE "ratings" ADD COLUMN "packageId" TEXT;

-- Backfill existing ratings from their reservation's package
UPDATE "ratings" r
SET "packageId" = res."packageId"
FROM "reservations" res
WHERE res."id" = r."reservationId";

-- Make it NOT NULL (all rows backfilled)
ALTER TABLE "ratings" ALTER COLUMN "packageId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ratings_packageId_idx" ON "ratings"("packageId");

-- AddForeignKey
ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "food_packages"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;