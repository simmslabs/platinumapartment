-- DropForeignKey
ALTER TABLE "public"."RoomAsset" DROP CONSTRAINT "RoomAsset_roomId_fkey";

-- AlterTable
ALTER TABLE "public"."RoomAsset" ALTER COLUMN "roomId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."RoomAsset" ADD CONSTRAINT "RoomAsset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
