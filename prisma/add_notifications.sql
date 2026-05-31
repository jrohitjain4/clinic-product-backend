-- Add Notification table (data-safe approach)
CREATE TABLE IF NOT EXISTS "Notification" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "clinicId" TEXT NOT NULL REFERENCES "Clinic"(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  "targetRole" TEXT NOT NULL DEFAULT 'ALL',
  "targetUserId" TEXT,
  link TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Notification_clinicId_idx" ON "Notification"("clinicId");
CREATE INDEX IF NOT EXISTS "Notification_targetUserId_idx" ON "Notification"("targetUserId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead");
