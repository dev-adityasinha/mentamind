-- AlterTable: add hospital-assigned donor fields to BloodRequest
ALTER TABLE "BloodRequest"
  ADD COLUMN "assignedDonorId" TEXT,
  ADD COLUMN "assignedAt"      TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "BloodRequest"
  ADD CONSTRAINT "BloodRequest_assignedDonorId_fkey"
  FOREIGN KEY ("assignedDonorId")
  REFERENCES "Donor"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "BloodRequest_assignedDonorId_idx" ON "BloodRequest"("assignedDonorId");
