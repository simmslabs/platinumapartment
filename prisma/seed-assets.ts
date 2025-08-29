import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAssets() {
  console.log("🏠 Seeding assets...");

  // Get some rooms to add assets to
  const rooms = await prisma.room.findMany({
    take: 5,
    include: {
      type: true,
    },
  });

  if (rooms.length === 0) {
    console.log("No rooms found. Please seed rooms first.");
    return;
  }

  const assetsToCreate = [
    // Room 1 - Standard Room Assets
    {
      roomId: rooms[0].id,
      name: "Queen Size Bed",
      category: "FURNITURE",
      condition: "GOOD",
      quantity: 1,
      description: "Comfortable queen size bed with memory foam mattress",
      notes: "Recently inspected, good condition",
    },
    {
      roomId: rooms[0].id,
      name: "32 inch Smart TV",
      category: "ELECTRONICS",
      condition: "EXCELLENT",
      quantity: 1,
      serialNumber: "TV-001-2024",
      description: "32 inch Samsung Smart TV with Netflix and streaming apps",
    },
    {
      roomId: rooms[0].id,
      name: "Air Conditioner",
      category: "ELECTRONICS",
      condition: "GOOD",
      quantity: 1,
      serialNumber: "AC-001-2024",
      description: "Split unit air conditioner, 1.5 ton capacity",
      notes: "Filter cleaned last month",
    },
    {
      roomId: rooms[0].id,
      name: "Study Desk",
      category: "FURNITURE",
      condition: "GOOD",
      quantity: 1,
      description: "Wooden study desk with drawers",
    },
    {
      roomId: rooms[0].id,
      name: "Office Chair",
      category: "FURNITURE",
      condition: "FAIR",
      quantity: 1,
      description: "Ergonomic office chair",
      notes: "Wheel needs replacement",
    },
    {
      roomId: rooms[0].id,
      name: "Ceiling Light",
      category: "LIGHTING",
      condition: "EXCELLENT",
      quantity: 1,
      description: "LED ceiling light with remote control",
    },
    {
      roomId: rooms[0].id,
      name: "Bedside Lamp",
      category: "LIGHTING",
      condition: "GOOD",
      quantity: 2,
      description: "Modern bedside table lamps",
    },
    {
      roomId: rooms[0].id,
      name: "Curtains",
      category: "DECORATION",
      condition: "GOOD",
      quantity: 1,
      description: "Blackout curtains for privacy",
    },
  ];

  // Add assets to more rooms if available
  if (rooms.length > 1) {
    assetsToCreate.push(
      // Room 2 - Deluxe Room Assets
      {
        roomId: rooms[1].id,
        name: "King Size Bed",
        category: "FURNITURE",
        condition: "EXCELLENT",
        quantity: 1,
        description: "Luxury king size bed with premium mattress",
      },
      {
        roomId: rooms[1].id,
        name: "42 inch Smart TV",
        category: "ELECTRONICS",
        condition: "EXCELLENT",
        quantity: 1,
        serialNumber: "TV-002-2024",
        description: "42 inch LG Smart TV with premium channels",
      },
      {
        roomId: rooms[1].id,
        name: "Mini Refrigerator",
        category: "ELECTRONICS",
        condition: "GOOD",
        quantity: 1,
        serialNumber: "REF-001-2024",
        description: "Compact mini fridge for beverages and snacks",
      },
      {
        roomId: rooms[1].id,
        name: "Microwave",
        category: "KITCHEN",
        condition: "GOOD",
        quantity: 1,
        serialNumber: "MW-001-2024",
        description: "Compact microwave for quick meals",
      },
      {
        roomId: rooms[1].id,
        name: "Coffee Maker",
        category: "KITCHEN",
        condition: "EXCELLENT",
        quantity: 1,
        description: "Single serve coffee maker with pods",
      },
      {
        roomId: rooms[1].id,
        name: "Wardrobe",
        category: "FURNITURE",
        condition: "GOOD",
        quantity: 1,
        description: "Large wooden wardrobe with hangers",
      },
      {
        roomId: rooms[1].id,
        name: "Safe Box",
        category: "SAFETY",
        condition: "EXCELLENT",
        quantity: 1,
        serialNumber: "SAFE-001-2024",
        description: "Digital safe box for valuables",
      },
    );
  }

  // Add bathroom assets to room 3 if available
  if (rooms.length > 2) {
    assetsToCreate.push(
      {
        roomId: rooms[2].id,
        name: "Shower Head",
        category: "BATHROOM",
        condition: "GOOD",
        quantity: 1,
        description: "Rain shower head with adjustable pressure",
      },
      {
        roomId: rooms[2].id,
        name: "Bathroom Mirror",
        category: "BATHROOM",
        condition: "EXCELLENT",
        quantity: 1,
        description: "Large bathroom mirror with LED lighting",
      },
      {
        roomId: rooms[2].id,
        name: "Toilet Paper Holder",
        category: "BATHROOM",
        condition: "GOOD",
        quantity: 1,
        description: "Wall-mounted toilet paper holder",
      },
      {
        roomId: rooms[2].id,
        name: "Towel Rack",
        category: "BATHROOM",
        condition: "GOOD",
        quantity: 1,
        description: "Stainless steel towel rack",
      },
    );
  }

  // Add some problematic assets for demonstration
  if (rooms.length > 3) {
    assetsToCreate.push(
      {
        roomId: rooms[3].id,
        name: "Old TV",
        category: "ELECTRONICS",
        condition: "BROKEN",
        quantity: 1,
        description: "32 inch CRT TV - needs replacement",
        notes: "Display not working, scheduled for replacement",
      },
      {
        roomId: rooms[3].id,
        name: "Damaged Chair",
        category: "FURNITURE",
        condition: "DAMAGED",
        quantity: 1,
        description: "Office chair with broken armrest",
        notes: "Armrest broken, needs repair",
      },
      {
        roomId: rooms[3].id,
        name: "Missing Lamp",
        category: "LIGHTING",
        condition: "MISSING",
        quantity: 1,
        description: "Table lamp that was reported missing",
        notes: "Reported missing by housekeeping on last inspection",
      },
    );
  }

  // Create all assets
  const createdAssets = [];
  for (const assetData of assetsToCreate) {
    try {
      const asset = await prisma.roomAsset.create({
        data: {
          ...assetData,
          lastInspected: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000) : null, // Random inspection date within last 6 months or null
          purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random purchase date within last year
        },
      });
      createdAssets.push(asset);
    } catch (error) {
      console.error(`Failed to create asset: ${assetData.name}`, error);
    }
  }

  console.log(`✅ Created ${createdAssets.length} assets across ${rooms.length} rooms`);

  // Display summary
  const summary = await prisma.roomAsset.groupBy({
    by: ['condition'],
    _count: {
      id: true,
    },
  });

  console.log("\n📊 Asset Summary by Condition:");
  summary.forEach(group => {
    console.log(`  ${group.condition}: ${group._count.id} assets`);
  });

  const categorySummary = await prisma.roomAsset.groupBy({
    by: ['category'],
    _count: {
      id: true,
    },
  });

  console.log("\n📦 Asset Summary by Category:");
  categorySummary.forEach(group => {
    console.log(`  ${group.category}: ${group._count.id} assets`);
  });
}

// Run the seed function
if (require.main === module) {
  seedAssets()
    .catch((e) => {
      console.error("❌ Error seeding assets:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedAssets };
