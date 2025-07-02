-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);
