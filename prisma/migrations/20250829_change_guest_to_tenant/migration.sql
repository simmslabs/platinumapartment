-- CreateEnum
-- Add TENANT to the enum first
ALTER TYPE "UserRole" ADD VALUE 'TENANT';

-- Update all GUEST users to TENANT
UPDATE "User" SET role = 'TENANT' WHERE role = 'GUEST';

-- Remove GUEST from the enum (this requires recreating the enum)
-- First create a new enum
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'TENANT');

-- Update the table to use the new enum
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (role::text::"UserRole_new");

-- Drop the old enum and rename the new one
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Update the default value
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'TENANT';
