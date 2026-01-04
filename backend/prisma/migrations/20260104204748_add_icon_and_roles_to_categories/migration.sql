-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "ServiceSubType" ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "ServiceSubTypeRole" (
    "id" SERIAL NOT NULL,
    "subTypeId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "ServiceSubTypeRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceSubTypeRole_role_idx" ON "ServiceSubTypeRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubTypeRole_subTypeId_role_key" ON "ServiceSubTypeRole"("subTypeId", "role");

-- AddForeignKey
ALTER TABLE "ServiceSubTypeRole" ADD CONSTRAINT "ServiceSubTypeRole_subTypeId_fkey" FOREIGN KEY ("subTypeId") REFERENCES "ServiceSubType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
