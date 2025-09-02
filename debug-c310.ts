import { db } from './app/utils/db.server';
import { updateRoomStatus } from './app/utils/room-status.server';

async function debugRoomC310() {
  console.log("🔍 Investigating Room C310...\n");
  
  try {
    // Find Room C310
    const room = await db.room.findFirst({
      where: { number: "C310" },
      include: {
        bookings: {
          where: {
            status: { in: ["CHECKED_IN", "CONFIRMED", "PENDING"] },
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          },
          orderBy: {
            checkIn: "desc",
          }
        }
      }
    });

    if (!room) {
      console.log("❌ Room C310 not found in database");
      return;
    }

    console.log(`📋 Room C310 Details:`);
    console.log(`   ID: ${room.id}`);
    console.log(`   Current Status: ${room.status}`);
    console.log(`   Block: ${room.block}`);
    console.log(`   Floor: ${room.floor}`);
    console.log(`   Active Bookings: ${room.bookings.length}\n`);

    if (room.bookings.length > 0) {
      console.log("📅 Active Bookings:");
      const now = new Date();
      
      room.bookings.forEach((booking, index) => {
        const isCurrentlyActive = 
          booking.status === "CHECKED_IN" ||
          (booking.status === "CONFIRMED" || booking.status === "PENDING") &&
          booking.checkIn <= now && booking.checkOut > now;
          
        console.log(`   ${index + 1}. ${booking.user.firstName} ${booking.user.lastName}`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      Check-in: ${booking.checkIn.toISOString()}`);
        console.log(`      Check-out: ${booking.checkOut.toISOString()}`);
        console.log(`      Currently Active: ${isCurrentlyActive ? '✅ YES' : '❌ NO'}`);
        
        if (!isCurrentlyActive) {
          if (booking.status !== "CHECKED_IN" && booking.status !== "CONFIRMED" && booking.status !== "PENDING") {
            console.log(`      Reason: Status is ${booking.status}`);
          } else if (booking.checkIn > now) {
            console.log(`      Reason: Check-in is in the future`);
          } else if (booking.checkOut <= now) {
            console.log(`      Reason: Check-out has passed`);
          }
        }
        console.log("");
      });
    } else {
      console.log("   No active bookings found\n");
    }

    // Update room status and see what it should be
    console.log("🔄 Updating room status...");
    const newStatus = await updateRoomStatus(room.id);
    console.log(`   Room status updated to: ${newStatus}`);
    
    // Check if there's a mismatch
    if (room.status !== newStatus) {
      console.log(`✅ Status mismatch fixed! Changed from ${room.status} to ${newStatus}`);
    } else {
      console.log(`ℹ️  Status was already correct: ${newStatus}`);
    }

  } catch (error) {
    console.error("❌ Error investigating Room C310:", error);
  } finally {
    await db.$disconnect();
  }
}

debugRoomC310();
