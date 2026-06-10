-- DropForeignKey
ALTER TABLE "Payroll" DROP CONSTRAINT "Payroll_staffId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "followUpPaymentStatus" TEXT,
ADD COLUMN     "followUpStatus" TEXT,
ADD COLUMN     "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentAppointmentId" TEXT,
ADD COLUMN     "paymentStatus" TEXT;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "followUpFee" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "doctorId" TEXT,
ALTER COLUMN "staffId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Payroll_doctorId_idx" ON "Payroll"("doctorId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_parentAppointmentId_fkey" FOREIGN KEY ("parentAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
