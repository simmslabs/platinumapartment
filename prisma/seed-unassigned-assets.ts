import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedUnassignedAssets() {
  console.log("🏠 Seeding unassigned assets...");

  const unassignedAssets = [
    {
      name: "50 inch Smart TV",
      category: "ELECTRONICS",
      condition: "EXCELLENT",
      quantity: 1,
      serialNumber: "TV-SA-001",
      description: "Samsung 50 inch 4K Smart TV with Netflix and streaming apps",
    },
    {
      name: "Queen Size Memory Foam Mattress",
      category: "FURNITURE",
      condition: "GOOD",
      quantity: 1,
      description: "High-quality memory foam mattress with cooling gel layer",
    },
    {
      name: "Wooden Wardrobe",
      category: "FURNITURE",
      condition: "EXCELLENT",
      quantity: 1,
      description: "3-door wooden wardrobe with mirrors and drawers",
    },
    {
      name: "Mini Refrigerator",
      category: "ELECTRONICS",
      condition: "GOOD",
      quantity: 1,
      serialNumber: "REF-MR-002",
      description: "Compact mini refrigerator perfect for beverages and snacks",
    },
    {
      name: "Standing Desk Lamp",
      category: "LIGHTING",
      condition: "EXCELLENT",
      quantity: 2,
      description: "Modern LED standing lamp with adjustable brightness",
    },
    {
      name: "Bathroom Mirror",
      category: "BATHROOM",
      condition: "EXCELLENT",
      quantity: 3,
      description: "Large bathroom mirror with LED lighting",
    },
    {
      name: "Dining Table Set",
      category: "FURNITURE",
      condition: "FAIR",
      quantity: 1,
      description: "4-person dining table with chairs - some wear on surface",
      notes: "Surface scratches, but structurally sound",
    },
    {
      name: "Air Purifier",
      category: "ELECTRONICS",
      condition: "GOOD",
      quantity: 1,
      serialNumber: "AP-HP-003",
      description: "HEPA air purifier with UV sterilization",
    },
    {
      name: "Bedside Table",
      category: "FURNITURE",
      condition: "GOOD",
      quantity: 4,
      description: "Wooden bedside table with drawer and shelf",
    },
    {
      name: "Coffee Machine",
      category: "KITCHEN",
      condition: "EXCELLENT",
      quantity: 1,
      serialNumber: "CM-DL-004",
      description: "Automatic espresso coffee machine with milk frother",
    },
    {
      name: "Shower Curtain Set",
      category: "BATHROOM",
      condition: "EXCELLENT",
      quantity: 5,
      description: "Waterproof shower curtain with hooks and liner",
    },
    {
      name: "Wall Art Collection",
      category: "DECORATION",
      condition: "EXCELLENT",
      quantity: 1,
      description: "Set of 3 framed landscape paintings",
    },
    {
      name: "Vacuum Cleaner",
      category: "CLEANING",
      condition: "GOOD",
      quantity: 1,
      serialNumber: "VC-DY-005",
      description: "Cordless vacuum cleaner with multiple attachments",
    },
    {
      name: "Smoke Detector",
      category: "SAFETY",
      condition: "EXCELLENT",
      quantity: 8,
      description: "Battery-powered smoke detector with 10-year battery life",
    },
    {
      name: "Ceiling Fan",
      category: "ELECTRONICS",
      condition: "GOOD",
      quantity: 2,
      description: "3-speed ceiling fan with remote control and LED lighting",
    },
  ];

  try {
    // Create all unassigned assets
    for (const asset of unassignedAssets) {
      await prisma.roomAsset.create({
        data: {
          ...asset,
          roomId: null, // Explicitly set as unassigned
        },
      });
    }

    console.log(`✅ Successfully created ${unassignedAssets.length} unassigned assets!`);
    
    // Show summary by category
    const assetsByCategory = await prisma.roomAsset.groupBy({
      by: ['category'],
      where: {
        roomId: null,
      },
      _count: {
        id: true,
      },
    });

    console.log("\n📊 Unassigned Assets Summary:");
    assetsByCategory.forEach(group => {
      console.log(`  ${group.category}: ${group._count.id} assets`);
    });

  } catch (error) {
    console.error("❌ Error seeding unassigned assets:", error);
  }
}

// Run the seeding function
seedUnassignedAssets()
  .catch((e) => {
    console.error("❌ Error seeding unassigned assets:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
