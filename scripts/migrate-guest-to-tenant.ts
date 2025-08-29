// Migration script to update GUEST role to TENANT
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting migration: GUEST → TENANT');
  
  try {
    // Update all users with role GUEST to TENANT
    await prisma.$executeRaw`
      UPDATE "User" SET role = 'TENANT' WHERE role = 'GUEST'
    `;
    
    console.log(`✅ Updated users from GUEST to TENANT role`);
    
    // Verify the changes
    const tenantCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "User" WHERE role = 'TENANT'
    ` as { count: bigint }[];
    
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
