-- AlterTable: Add maxDoctors, maxPatients, maxAppointments to SubscriptionPackage
ALTER TABLE "SubscriptionPackage" ADD COLUMN IF NOT EXISTS "maxDoctors" INTEGER;
ALTER TABLE "SubscriptionPackage" ADD COLUMN IF NOT EXISTS "maxPatients" INTEGER;
ALTER TABLE "SubscriptionPackage" ADD COLUMN IF NOT EXISTS "maxAppointments" INTEGER;
