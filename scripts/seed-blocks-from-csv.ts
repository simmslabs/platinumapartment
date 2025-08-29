import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BlockData {
  id: string;
  name: string;
  description: string;
  floors: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

function parseCSV(csvContent: string): BlockData[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    
    return {
      id: values[headers.indexOf('id')] || '',
      name: values[headers.indexOf('name')] || '',
      description: values[headers.indexOf('description')] || '',
      floors: values[headers.indexOf('floors')] || '',
      location: values[headers.indexOf('location')] || '',
      createdAt: values[headers.indexOf('createdAt')] || '',
      updatedAt: values[headers.indexOf('updatedAt')] || '',
    };
  });
}

async function seedBlocksFromCSV() {
  try {
    console.log('Starting to seed blocks from CSV...');
    
    // Read the CSV file
    const csvPath = path.join(__dirname, '../prisma/Block.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse the CSV
    const blockData = parseCSV(csvContent);
    
    console.log(`Found ${blockData.length} blocks in CSV`);
    
    // Clear existing blocks (be careful with this in production!)
    await prisma.block.deleteMany();
    console.log('Cleared existing blocks');
    
    // Create new blocks from CSV data
    const blocks = [];
    for (const blockCsv of blockData) {
      const block = await prisma.block.create({
        data: {
          name: blockCsv.name,
          description: blockCsv.description || null,
          floors: blockCsv.floors ? parseInt(blockCsv.floors) : null,
          location: blockCsv.location || null,
          // Let Prisma handle createdAt and updatedAt with current timestamps
        },
      });
      blocks.push(block);
      console.log(`Created block: ${block.name} - ${block.description}`);
    }
    
    console.log(`Successfully seeded ${blocks.length} blocks from CSV`);
    
  } catch (error) {
    console.error('Error seeding blocks from CSV:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
seedBlocksFromCSV()
  .then(() => {
    console.log('Block seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Block seeding failed:', error);
    process.exit(1);
  });
