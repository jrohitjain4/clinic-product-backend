/*
  Warnings:

  - You are about to drop the column `address` on the `Clinic` table. All the data in the column will be lost.
  - You are about to drop the column `gstNo` on the `Clinic` table. All the data in the column will be lost.
  - You are about to drop the column `subdomain` on the `Clinic` table. All the data in the column will be lost.
  - You are about to drop the column `specializationId` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SystemSetting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `Clinic` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Doctor" DROP CONSTRAINT "Doctor_specializationId_fkey";

-- DropIndex
DROP INDEX "Clinic_subdomain_key";

-- AlterTable
ALTER TABLE "Clinic" DROP COLUMN "address",
DROP COLUMN "gstNo",
DROP COLUMN "subdomain",
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "doctorCount" INTEGER,
ADD COLUMN     "isTrialUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "specializationId",
ADD COLUMN     "aadhaarCard" TEXT,
ADD COLUMN     "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpValidityDays" INTEGER,
ADD COLUMN     "freeFollowUpLimit" INTEGER,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "medicalRegCertificate" TEXT,
ADD COLUMN     "panCard" TEXT,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "qualificationCertificate" TEXT,
ADD COLUMN     "signatureImage" TEXT;

-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "DemoBooking" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "clinicName" TEXT,
    "dateTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DoctorToSpecialization" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_DoctorToSpecialization_AB_unique" ON "_DoctorToSpecialization"("A", "B");

-- CreateIndex
CREATE INDEX "_DoctorToSpecialization_B_index" ON "_DoctorToSpecialization"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_username_key" ON "Clinic"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "_DoctorToSpecialization" ADD CONSTRAINT "_DoctorToSpecialization_A_fkey" FOREIGN KEY ("A") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DoctorToSpecialization" ADD CONSTRAINT "_DoctorToSpecialization_B_fkey" FOREIGN KEY ("B") REFERENCES "Specialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
