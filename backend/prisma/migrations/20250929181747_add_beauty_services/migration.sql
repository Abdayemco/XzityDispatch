-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLEANING';

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "beautyServices" TEXT,
ADD COLUMN     "imageUri" TEXT,
ADD COLUMN     "subType" TEXT;
