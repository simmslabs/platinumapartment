// Direct SQL execution to migrate GUEST to TENANT
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting database migration: GUEST → TENANT');
  
  try {
    console.log('1. Adding TENANT to UserRole enum...');
    await prisma.$executeRaw`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TENANT'`;
    
    console.log('2. Updating all GUEST users to TENANT...');
    await prisma.$executeRaw`UPDATE "User" SET role = 'TENANT' WHERE role = 'GUEST'`;
    
    console.log('3. Creating new enum without GUEST...');
    await prisma.$executeRaw`CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'TENANT')`;
    
    console.log('4. Updating table to use new enum...');
    await prisma.$executeRaw`ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (role::text::"UserRole_new")`;
    
    console.log('5. Dropping old enum and renaming...');
    await prisma.$executeRaw`DROP TYPE "UserRole"`;
    await prisma.$executeRaw`ALTER TYPE "UserRole_new" RENAME TO "UserRole"`;
    
    console.log('6. Setting new default value...');
    await prisma.$executeRaw`ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'TENANT'`;
    
    // Verify the changes
    const tenantCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "User" WHERE role = 'TENANT'
    ` as { count: bigint }[];
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`✅ Total TENANT users: ${Number(tenantCount[0]?.count || 0)}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
