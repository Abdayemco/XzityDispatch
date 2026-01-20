-- DropIndex
DROP INDEX "Ride_scheduledAt_idx";

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "categoryName" TEXT,
ALTER COLUMN "vehicleType" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Ride_categoryName_idx" ON "Ride"("categoryName");

-- CreateIndex
CREATE INDEX "Ride_subType_idx" ON "Ride"("subType");
