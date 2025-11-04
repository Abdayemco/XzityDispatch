/*
  Warnings:

  - The values [CLEANING] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The values [SHOPPING,CLEANING] on the enum `VehicleType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `beautyServices` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `imageUri` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `subType` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `UserRole` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DRIVER', 'CUSTOMER', 'SHOPPER', 'HAIR_DRESSER', 'INSTITUTE', 'CLEANER', 'GARDENER', 'PLUMBER', 'ELECTRICIAN', 'ERRAND_RUNNER', 'BABYSITTER', 'TUTOR', 'LAUNDRY', 'PRIVATE_TRAINER', 'PHYSIOTHERAPIST', 'ELDER_CARE', 'FUTURE1', 'FUTURE2', 'FUTURE3');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VehicleType_new" AS ENUM ('CAR', 'TUKTUK', 'DELIVERY', 'LIMO', 'WHEELCHAIR', 'TRUCK', 'WATER_TRUCK', 'TOW_TRUCK', 'SHOPPER', 'HAIR_DRESSER', 'CLEANER', 'GARDENER', 'INSTITUTE', 'BEAUTY', 'PLUMBER', 'ELECTRICIAN', 'ERRAND_RUNNER', 'BABYSITTER', 'TUTOR', 'LAUNDRY', 'PRIVATE_TRAINER', 'PHYSIOTHERAPIST', 'ELDER_CARE', 'FUTURE1', 'FUTURE2', 'FUTURE3');
ALTER TABLE "User" ALTER COLUMN "vehicleType" TYPE "VehicleType_new" USING ("vehicleType"::text::"VehicleType_new");
ALTER TABLE "Ride" ALTER COLUMN "vehicleType" TYPE "VehicleType_new" USING ("vehicleType"::text::"VehicleType_new");
ALTER TABLE "Vehicle" ALTER COLUMN "type" TYPE "VehicleType_new" USING ("type"::text::"VehicleType_new");
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";
ALTER TYPE "VehicleType_new" RENAME TO "VehicleType";
DROP TYPE "VehicleType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Ride" DROP COLUMN "beautyServices",
DROP COLUMN "imageUri",
DROP COLUMN "subType",
ADD COLUMN     "jobDetails" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "serviceProfile" JSONB;

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN "verified";
