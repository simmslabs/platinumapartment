-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "gender" "public"."Gender",
ADD COLUMN     "idCard" TEXT,
ADD COLUMN     "profilePicture" TEXT;

-- CreateIndex
CREATE INDEX "User_idCard_idx" ON "public"."User"("idCard");
