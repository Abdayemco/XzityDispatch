/*
  Warnings:

  - The primary key for the `Ride` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cancelledAt` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Ride` table. All the data in the column will be lost.
  - The `id` column on the `Ride` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `customerId` column on the `Ride` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `driverId` column on the `Ride` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isAvailable` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lat` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `trialEndsAt` on the `User` table. All the data in the column will be lost.
  - The `id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Chat` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `isBusy` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_rideId_fkey";

-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_senderId_fkey";

-- DropForeignKey
ALTER TABLE "Ride" DROP CONSTRAINT "Ride_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Ride" DROP CONSTRAINT "Ride_driverId_fkey";

-- AlterTable
ALTER TABLE "Ride" DROP CONSTRAINT "Ride_pkey",
DROP COLUMN "cancelledAt",
DROP COLUMN "completedAt",
DROP COLUMN "price",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" INTEGER,
DROP COLUMN "driverId",
ADD COLUMN     "driverId" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ADD CONSTRAINT "Ride_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "isAvailable",
DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "trialEndsAt",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "isBusy" SET NOT NULL,
ALTER COLUMN "isBusy" SET DEFAULT false,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Chat";

-- DropEnum
DROP TYPE "Status";

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
