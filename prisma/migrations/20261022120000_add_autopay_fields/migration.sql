-- AlterTable: Add AutoPay fields to Clinic and SubscriptionPackage
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "isAutoPayEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "razorpayCustomerId" TEXT;
ALTER TABLE "SubscriptionPackage" ADD COLUMN IF NOT EXISTS "razorpayPlanId" TEXT;
