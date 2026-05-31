-- Make clinicId nullable in Notification table to support Super Admin global notifications
ALTER TABLE "Notification" ALTER COLUMN "clinicId" DROP NOT NULL;
-- Drop the old NOT NULL foreign key index and recreate
DROP INDEX IF EXISTS "Notification_clinicId_idx";
CREATE INDEX IF NOT EXISTS "Notification_clinicId_idx" ON "Notification"("clinicId");
