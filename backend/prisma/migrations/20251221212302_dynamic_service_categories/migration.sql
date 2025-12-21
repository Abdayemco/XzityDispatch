-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'CARPENTER';
ALTER TYPE "Role" ADD VALUE 'HANDYMAN';
ALTER TYPE "Role" ADD VALUE 'ROOFER';
ALTER TYPE "Role" ADD VALUE 'FENCER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleType" ADD VALUE 'CARPENTER';
ALTER TYPE "VehicleType" ADD VALUE 'HANDYMAN';
ALTER TYPE "VehicleType" ADD VALUE 'ROOFER';
ALTER TYPE "VehicleType" ADD VALUE 'FENCER';

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "serviceCategoryId" INTEGER,
ADD COLUMN     "serviceSubTypeId" INTEGER;

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSubType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceSubType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubType_name_categoryId_key" ON "ServiceSubType"("name", "categoryId");

-- AddForeignKey
ALTER TABLE "ServiceSubType" ADD CONSTRAINT "ServiceSubType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_serviceSubTypeId_fkey" FOREIGN KEY ("serviceSubTypeId") REFERENCES "ServiceSubType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
