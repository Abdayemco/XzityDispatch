-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSubscriptionDisabled" BOOLEAN DEFAULT false,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "subscriptionFee" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "subscriptionStatus" TEXT DEFAULT 'trial',
ADD COLUMN     "trial_end" TIMESTAMP(3),
ADD COLUMN     "trial_start" TIMESTAMP(3);
