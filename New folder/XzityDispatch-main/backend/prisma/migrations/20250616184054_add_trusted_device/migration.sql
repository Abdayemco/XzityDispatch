-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_userId_deviceId_key" ON "TrustedDevice"("userId", "deviceId");

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
