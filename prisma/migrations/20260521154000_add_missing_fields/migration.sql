-- CreateEnum
CREATE TYPE "ClinicStatus" AS ENUM ('IN_PROGRESS', 'TRIAL', 'TRIAL_EXPIRED', 'TRIAL_COMPLETED_NOT_UPGRADED', 'UPGRADED', 'FAILED');

-- CreateTable
CREATE TABLE "SubscriptionPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "durationInDays" INTEGER NOT NULL,
    "maxDoctors" INTEGER NOT NULL,
    "maxPatients" INTEGER NOT NULL,
    "maxAppointments" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPackage_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add missing columns to Clinic
ALTER TABLE "Clinic"
    ADD COLUMN IF NOT EXISTS "gstNo" TEXT,
    ADD COLUMN IF NOT EXISTS "status" "ClinicStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    ADD COLUMN IF NOT EXISTS "packageId" TEXT,
    ADD COLUMN IF NOT EXISTS "packageStartsAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "packageExpiresAt" TIMESTAMP(3);

-- Make subdomain nullable (was NOT NULL before)
ALTER TABLE "Clinic" ALTER COLUMN "subdomain" DROP NOT NULL;

-- AlterTable: Add missing columns to User
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "dob" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "age" INTEGER,
    ADD COLUMN IF NOT EXISTS "gender" TEXT;

-- AddForeignKey: Clinic -> SubscriptionPackage
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SubscriptionPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
