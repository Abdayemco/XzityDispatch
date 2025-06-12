/*
  Warnings:

  - Added the required column `vehicleType` to the `Ride` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'BIKE', 'TUKTUK', 'TRUCK');

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "vehicleType" "VehicleType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAvailable" BOOLEAN,
ADD COLUMN     "isBusy" BOOLEAN,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "vehicleType" "VehicleType";
