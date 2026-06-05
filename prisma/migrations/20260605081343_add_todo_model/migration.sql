-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "gstNumber" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "departmentCode" TEXT,
ADD COLUMN     "iconUrl" TEXT;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "alternateMobile" TEXT,
ADD COLUMN     "doctorCode" TEXT;

-- AlterTable
ALTER TABLE "LandingPage" ADD COLUMN     "aboutImage" TEXT,
ADD COLUMN     "faqs" JSONB DEFAULT '[]',
ADD COLUMN     "gmbUrl" TEXT,
ADD COLUMN     "headerImage" TEXT,
ADD COLUMN     "timetable" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "evidenceFiles" JSONB DEFAULT '[]',
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectRemark" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "workingDays" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "aadhaarNumber" TEXT,
ADD COLUMN     "alternateMobile" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "referredBy" TEXT;

-- CreateTable
CREATE TABLE "WorkingDaysConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "offDays" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "schedules" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingDaysConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "clinicId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkingDaysConfig_clinicId_key" ON "WorkingDaysConfig"("clinicId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Todo_clinicId_idx" ON "Todo"("clinicId");

-- CreateIndex
CREATE INDEX "Todo_status_idx" ON "Todo"("status");

-- AddForeignKey
ALTER TABLE "WorkingDaysConfig" ADD CONSTRAINT "WorkingDaysConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
