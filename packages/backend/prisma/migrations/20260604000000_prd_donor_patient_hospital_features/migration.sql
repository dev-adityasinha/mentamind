-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CONNECTED', 'NOT_REACHABLE', 'INTERESTED', 'REJECTED', 'CALLBACK_REQUESTED', 'DONATED');

-- AlterTable
ALTER TABLE "BloodRequest" ADD COLUMN     "bedNumber" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "hospitalName" TEXT,
ADD COLUMN     "ocrData" JSONB,
ADD COLUMN     "priorityLevel" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "requisitionFileKey" TEXT,
ADD COLUMN     "treatingDoctor" TEXT;

-- AlterTable
ALTER TABLE "Donor" ADD COLUMN     "city" TEXT,
ADD COLUMN     "responseScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "department" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MedicineRequest" ADD COLUMN     "diseaseProofFileKey" TEXT,
ADD COLUMN     "doctorRecommendationFileKey" TEXT,
ADD COLUMN     "incomeCertificateFileKey" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "gender" "Gender";

-- CreateTable
CREATE TABLE "DonorCallLog" (
    "id" TEXT NOT NULL,
    "bloodRequestId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "callStatus" "CallStatus" NOT NULL,
    "callAttempt" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonorCallLog_bloodRequestId_idx" ON "DonorCallLog"("bloodRequestId");

-- CreateIndex
CREATE INDEX "DonorCallLog_donorId_idx" ON "DonorCallLog"("donorId");

-- CreateIndex
CREATE INDEX "DonorCallLog_volunteerId_idx" ON "DonorCallLog"("volunteerId");

-- CreateIndex
CREATE INDEX "BloodRequest_priorityLevel_status_idx" ON "BloodRequest"("priorityLevel", "status");

-- CreateIndex
CREATE INDEX "Hospital_isVerified_isActive_idx" ON "Hospital"("isVerified", "isActive");

-- AddForeignKey
ALTER TABLE "DonorCallLog" ADD CONSTRAINT "DonorCallLog_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorCallLog" ADD CONSTRAINT "DonorCallLog_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorCallLog" ADD CONSTRAINT "DonorCallLog_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
