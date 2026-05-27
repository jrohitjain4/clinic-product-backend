-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientCode" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "profileImage" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "bloodGroup" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "address1" TEXT,
    "address2" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "primaryDoctorId" TEXT,
    "lastVisitedAt" TIMESTAMP(3),
    "vitals" JSONB,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");

-- CreateIndex
CREATE INDEX "Patient_primaryDoctorId_idx" ON "Patient"("primaryDoctorId");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_primaryDoctorId_fkey" FOREIGN KEY ("primaryDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
