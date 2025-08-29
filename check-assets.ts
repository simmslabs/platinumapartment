import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAssets() {
  const unassignedCount = await prisma.roomAsset.count({
    where: { roomId: null }
  });
  
  const assignedCount = await prisma.roomAsset.count({
    where: { roomId: { not: null } }
  });
  
  console.log(`Unassigned assets: ${unassignedCount}`);
  console.log(`Assigned assets: ${assignedCount}`);
  
  if (unassignedCount > 0) {
    console.log("\nSample unassigned assets:");
    const samples = await prisma.roomAsset.findMany({
      where: { roomId: null },
      take: 5,
      select: {
        name: true,
        category: true,
        condition: true,
      }
    });
    
    samples.forEach(asset => {
      console.log(`  - ${asset.name} (${asset.category}) - ${asset.condition}`);
    });
  }
  
  await prisma.$disconnect();
}

checkAssets();
