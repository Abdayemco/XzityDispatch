-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'VERIFIED';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "verificationCode" DROP NOT NULL;
