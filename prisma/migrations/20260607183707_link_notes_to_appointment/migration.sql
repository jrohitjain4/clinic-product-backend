-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "aadhaarCardBack" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "appointmentId" TEXT;

-- CreateIndex
CREATE INDEX "Note_appointmentId_idx" ON "Note"("appointmentId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
