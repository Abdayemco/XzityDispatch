-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastKnownLat" DOUBLE PRECISION,
ADD COLUMN     "lastKnownLng" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Chat_customerId_idx" ON "Chat"("customerId");

-- CreateIndex
CREATE INDEX "Chat_driverId_idx" ON "Chat"("driverId");

-- CreateIndex
CREATE INDEX "Ride_customerId_idx" ON "Ride"("customerId");

-- CreateIndex
CREATE INDEX "Ride_driverId_idx" ON "Ride"("driverId");

-- CreateIndex
CREATE INDEX "Ride_status_idx" ON "Ride"("status");

-- CreateIndex
CREATE INDEX "Ride_scheduledAt_idx" ON "Ride"("scheduledAt");
