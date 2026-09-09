-- CreateEnum
CREATE TYPE "BusinessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "business_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "businessLicenseUrl" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "BusinessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_requests_userId_status_idx" ON "business_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "business_requests_status_createdAt_idx" ON "business_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "business_requests" ADD CONSTRAINT "business_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_requests" ADD CONSTRAINT "business_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: a user can hold at most ONE PENDING business request.
-- Enforces the single-pending invariant at the database level (race-safe).
CREATE UNIQUE INDEX "business_requests_one_pending_per_user" ON "business_requests"("userId") WHERE "status" = 'PENDING';
