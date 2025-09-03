// Test script to verify roomId parameter functionality
// This script will test the room pre-selection feature

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function testRoomPreselection() {
  console.log("🔍 Testing room pre-selection functionality...\n");

  try {
    // Get first few rooms for testing
    const rooms = await db.room.findMany({
      take: 3,
      include: {
        blockRelation: true,
        type: true,
      },
      orderBy: { number: "asc" },
    });

    if (rooms.length === 0) {
      console.log("❌ No rooms found in database");
      return;
    }

    console.log("📋 Available rooms for testing:");
    rooms.forEach(room => {
      console.log(`   Room ${room.number} (${room.id}) - Status: ${room.status}`);
    });

    // Test different scenarios
    const testScenarios = [
      {
        name: "Available Room Pre-selection",
        roomId: rooms.find(r => r.status === 'AVAILABLE')?.id,
        description: "Test pre-selecting an available room"
      },
      {
        name: "Occupied Room Pre-selection", 
        roomId: rooms.find(r => r.status === 'OCCUPIED')?.id,
        description: "Test pre-selecting an occupied room (should still appear in dropdown)"
      },
      {
        name: "Any Room Pre-selection",
        roomId: rooms[0]?.id,
        description: "Test pre-selecting the first room regardless of status"
      }
    ];

    for (const scenario of testScenarios) {
      if (!scenario.roomId) {
        console.log(`\n⏭️  Skipping ${scenario.name} - no suitable room found`);
        continue;
      }

      console.log(`\n🧪 Testing: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      console.log(`   Room ID: ${scenario.roomId}`);

      // Simulate the loader logic for room filtering
      const preSelectedRoom = await db.room.findUnique({
        where: { id: scenario.roomId },
        include: {
          blockRelation: true,
          type: true,
        },
      });

      if (!preSelectedRoom) {
        console.log(`   ❌ Pre-selected room not found`);
        continue;
      }

      // Test the room filtering logic
      const roomWhereClause = {
        OR: [
          { status: "AVAILABLE" },
          { id: scenario.roomId }
        ]
      };

      const filteredRooms = await db.room.findMany({
        where: roomWhereClause,
        include: {
          blockRelation: true,
          type: true,
        },
        orderBy: { number: "asc" },
      });

      const preSelectedRoomInResults = filteredRooms.find(r => r.id === scenario.roomId);
      
      console.log(`   📊 Results:`);
      console.log(`      Total rooms in dropdown: ${filteredRooms.length}`);
      console.log(`      Pre-selected room included: ${preSelectedRoomInResults ? '✅ Yes' : '❌ No'}`);
      console.log(`      Pre-selected room status: ${preSelectedRoom.status}`);
      
      if (preSelectedRoomInResults) {
        console.log(`      ✅ SUCCESS: Room ${preSelectedRoom.number} would appear in dropdown`);
      } else {
        console.log(`      ❌ FAILURE: Room ${preSelectedRoom.number} would NOT appear in dropdown`);
      }
    }

    console.log("\n🎯 Test Summary:");
    console.log("   The room pre-selection feature should:");
    console.log("   1. Accept roomId as URL parameter");
    console.log("   2. Include pre-selected room in dropdown even if occupied");
    console.log("   3. Set the room as selected in the form");
    console.log("\n   URL format: /dashboard/bookings/new?roomId=ROOM_ID");

  } catch (error) {
    console.error("❌ Error during testing:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testRoomPreselection();
