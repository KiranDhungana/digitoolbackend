-- CreateEnum
CREATE TYPE "ReferralWithdrawalStatus" AS ENUM ('pending', 'completed', 'rejected');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT,
ADD COLUMN "referralBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "User" SET "referralCode" = UPPER(SUBSTRING(MD5("id") FROM 1 FOR 8))
WHERE "referralCode" IS NULL;

ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "SignupVerification" ADD COLUMN "referredById" TEXT;

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ReferralWithdrawalStatus" NOT NULL DEFAULT 'pending',
    "payoutNote" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCommission_orderId_key" ON "ReferralCommission"("orderId");

CREATE INDEX "ReferralCommission_referrerId_idx" ON "ReferralCommission"("referrerId");

CREATE INDEX "ReferralCommission_createdAt_idx" ON "ReferralCommission"("createdAt");

CREATE INDEX "ReferralWithdrawal_userId_idx" ON "ReferralWithdrawal"("userId");

CREATE INDEX "ReferralWithdrawal_status_idx" ON "ReferralWithdrawal"("status");

CREATE INDEX "ReferralWithdrawal_createdAt_idx" ON "ReferralWithdrawal"("createdAt");

ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralWithdrawal" ADD CONSTRAINT "ReferralWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
