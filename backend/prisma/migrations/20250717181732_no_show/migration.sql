-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RideStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "RideStatus" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "noShowReportedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledAt" TIMESTAMP(3);
