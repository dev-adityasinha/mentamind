-- CreateEnum
CREATE TYPE "DonorResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable: appointment date + donor response tracking
ALTER TABLE "BloodRequest"
  ADD COLUMN "appointmentDate"     TIMESTAMP(3),
  ADD COLUMN "donorResponseStatus" "DonorResponseStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "donorResponseAt"     TIMESTAMP(3),
  ADD COLUMN "donorDeclineReason"  TEXT;
