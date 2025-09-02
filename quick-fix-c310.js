import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickFixC310() {
  try {
    console.log("🔍 Quick fix for Room C310...\n");
    
    // Find Room C310
    const room = await prisma.room.findFirst({
      where: { 
        number: "C310"
      },
      include: {
        bookings: {
          where: {
            status: { in: ["CHECKED_IN", "CONFIRMED", "PENDING"] },
          },
          include: {
            user: true
          }
        }
      }
    });

    if (!room) {
      console.log("❌ Room C310 not found");
      return;
    }

    console.log(`📋 Room C310 (${room.id}):`);
    console.log(`   Current Status: ${room.status}`);
    console.log(`   Active Bookings: ${room.bookings.length}`);

    const now = new Date();
    let shouldBeOccupied = false;

    if (room.bookings.length > 0) {
      console.log("\n📅 Checking bookings:");
      room.bookings.forEach((booking, i) => {
        const isActive = booking.status === "CHECKED_IN" ||
          (booking.status === "CONFIRMED" || booking.status === "PENDING") &&
          booking.checkIn <= now && booking.checkOut > now;
        
        console.log(`   ${i + 1}. ${booking.user.firstName} ${booking.user.lastName}`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      Active: ${isActive ? 'YES' : 'NO'}`);
        
        if (isActive) {
          shouldBeOccupied = true;
        }
      });
    }

    const correctStatus = shouldBeOccupied ? "OCCUPIED" : "AVAILABLE";
    console.log(`\n🎯 Should be: ${correctStatus}`);

    if (room.status !== correctStatus) {
      console.log("🔄 Updating room status...");
      await prisma.room.update({
        where: { id: room.id },
        data: { status: correctStatus }
      });
      console.log(`✅ Room C310 status updated from ${room.status} to ${correctStatus}`);
    } else {
      console.log("ℹ️  Room status is already correct");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

quickFixC310();
