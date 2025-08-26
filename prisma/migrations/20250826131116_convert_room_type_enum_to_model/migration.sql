/*
  Warnings:

  - You are about to drop the column `type` on the `Room` table. All the data in the column will be lost.
  - Added the required column `typeId` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Room_type_idx";

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "type",
ADD COLUMN     "typeId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "public"."RoomType";

-- CreateTable
CREATE TABLE "public"."RoomType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DOUBLE PRECISION,
    "maxCapacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_name_key" ON "public"."RoomType"("name");

-- CreateIndex
CREATE INDEX "RoomType_name_idx" ON "public"."RoomType"("name");

-- CreateIndex
CREATE INDEX "RoomType_isActive_idx" ON "public"."RoomType"("isActive");

-- CreateIndex
CREATE INDEX "Room_typeId_idx" ON "public"."Room"("typeId");

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
