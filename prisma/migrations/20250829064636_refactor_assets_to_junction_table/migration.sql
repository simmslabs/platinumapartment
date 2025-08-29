/*
  Warnings:

  - You are about to drop the column `category` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `lastInspected` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseDate` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumber` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `RoomAsset` table. All the data in the column will be lost.
  - You are about to drop the column `warrantyExpiry` on the `RoomAsset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[roomId,assetId]` on the table `RoomAsset` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `assetId` to the `RoomAsset` table without a default value. This is not possible if the table is not empty.
  - Made the column `roomId` on table `RoomAsset` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."MaintenanceLog" DROP CONSTRAINT "MaintenanceLog_assetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RoomAsset" DROP CONSTRAINT "RoomAsset_roomId_fkey";

-- DropIndex
DROP INDEX "public"."RoomAsset_category_idx";

-- DropIndex
DROP INDEX "public"."RoomAsset_createdAt_idx";

-- DropIndex
DROP INDEX "public"."RoomAsset_lastInspected_idx";

-- DropIndex
DROP INDEX "public"."RoomAsset_name_idx";

-- AlterTable
ALTER TABLE "public"."RoomAsset" DROP COLUMN "category",
DROP COLUMN "createdAt",
DROP COLUMN "description",
DROP COLUMN "lastInspected",
DROP COLUMN "name",
DROP COLUMN "purchaseDate",
DROP COLUMN "serialNumber",
DROP COLUMN "updatedAt",
DROP COLUMN "warrantyExpiry",
ADD COLUMN     "assetId" TEXT NOT NULL,
ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "roomId" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "public"."AssetCategory" NOT NULL,
    "description" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "lastInspected" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "public"."Asset"("category");

-- CreateIndex
CREATE INDEX "Asset_name_idx" ON "public"."Asset"("name");

-- CreateIndex
CREATE INDEX "Asset_lastInspected_idx" ON "public"."Asset"("lastInspected");

-- CreateIndex
CREATE INDEX "Asset_createdAt_idx" ON "public"."Asset"("createdAt");

-- CreateIndex
CREATE INDEX "RoomAsset_assetId_idx" ON "public"."RoomAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAsset_roomId_assetId_key" ON "public"."RoomAsset"("roomId", "assetId");

-- AddForeignKey
ALTER TABLE "public"."RoomAsset" ADD CONSTRAINT "RoomAsset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomAsset" ADD CONSTRAINT "RoomAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
