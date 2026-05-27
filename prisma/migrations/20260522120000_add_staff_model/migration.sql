-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "staffCode" TEXT,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "profileImage" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "bloodGroup" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "dateOfJoining" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Active',
    "designationId" TEXT,
    "departmentId" TEXT,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
