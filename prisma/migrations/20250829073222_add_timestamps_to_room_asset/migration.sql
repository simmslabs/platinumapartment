/*
  Warnings:

  - Added the required column `updatedAt` to the `RoomAsset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."RoomAsset" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "RoomAsset_assignedAt_idx" ON "public"."RoomAsset"("assignedAt");
