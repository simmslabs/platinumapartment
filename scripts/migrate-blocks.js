import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateBlocks() {
  try {
    console.log('Starting block migration...');

    // Get all rooms to extract unique block names
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        block: true
      }
    });

    console.log(`Found ${rooms.length} rooms`);

    // Get unique block names
    const uniqueBlockNames = [...new Set(rooms.map(room => room.block))];
    console.log(`Found unique blocks: ${uniqueBlockNames.join(', ')}`);

    // Create Block records for each unique block name
    const createdBlocks = {};
    for (const blockName of uniqueBlockNames) {
      const block = await prisma.block.create({
        data: {
          name: blockName,
          description: `Block ${blockName}`,
        }
      });
      createdBlocks[blockName] = block.id;
      console.log(`Created block: ${blockName} with ID: ${block.id}`);
    }

    // Update each room with the corresponding blockId
    for (const room of rooms) {
      const blockId = createdBlocks[room.block];
      await prisma.room.update({
        where: { id: room.id },
        data: { blockId }
      });
      console.log(`Updated room ${room.id} with blockId: ${blockId}`);
    }

    console.log('Block migration completed successfully!');
  } catch (error) {
    console.error('Error during block migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateBlocks()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
