-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "otp_challenges_ipAddress_creeLe_idx" ON "otp_challenges"("ipAddress", "creeLe");
