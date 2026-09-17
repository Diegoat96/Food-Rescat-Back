-- Ratings can now be created directly for a package (without a reservation)
ALTER TABLE "ratings" ALTER COLUMN "reservationId" DROP NOT NULL;

-- A client may rate a given package only once
CREATE UNIQUE INDEX "ratings_clientId_packageId_key" ON "ratings"("clientId", "packageId");