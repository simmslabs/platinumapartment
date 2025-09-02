import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugBookings() {
  try {
    console.log("=== Current Booking Status Debug ===\n");
    
    const now = new Date();
    console.log("Current time:", now.toISOString());
    console.log("Current time local:", now.toString());
    
    // Get all bookings with their basic info
    const allBookings = await prisma.booking.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        room: {
          select: {
            number: true,
            block: true
          }
        },
        payment: {
          select: {
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\nTotal bookings in database: ${allBookings.length}\n`);

    if (allBookings.length === 0) {
      console.log("❌ No bookings found in the database!");
      return;
    }

    // Group by status
    const statusGroups = allBookings.reduce((acc, booking) => {
      if (!acc[booking.status]) {
        acc[booking.status] = [];
      }
      acc[booking.status].push(booking);
      return acc;
    }, {});

    console.log("Bookings by status:");
    Object.entries(statusGroups).forEach(([status, bookings]) => {
      console.log(`  ${status}: ${bookings.length} bookings`);
    });

    console.log("\n=== Detailed Analysis ===\n");

    // Check each booking against current guest criteria
    allBookings.slice(0, 10).forEach((booking, index) => {
      console.log(`${index + 1}. Booking ${booking.id}:`);
      console.log(`   Guest: ${booking.user.firstName} ${booking.user.lastName}`);
      console.log(`   Room: ${booking.room.block}-${booking.room.number}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Check-in: ${booking.checkIn.toISOString()}`);
      console.log(`   Check-out: ${booking.checkOut.toISOString()}`);
      console.log(`   Payment: ${booking.payment?.status || 'No payment'}`);
      
      // Apply current guest logic
      const isCheckedIn = booking.status === "CHECKED_IN";
      const isConfirmedAndActive = booking.status === "CONFIRMED" && booking.checkIn <= now && booking.checkOut > now;
      const qualifiesAsCurrentGuest = isCheckedIn || isConfirmedAndActive;
      
      console.log(`   ✅ Qualifies as current guest: ${qualifiesAsCurrentGuest}`);
      
      if (!qualifiesAsCurrentGuest) {
        if (booking.status !== "CHECKED_IN" && booking.status !== "CONFIRMED") {
          console.log(`      - Status '${booking.status}' is not CHECKED_IN or CONFIRMED`);
        } else if (booking.status === "CONFIRMED") {
          if (booking.checkIn > now) {
            console.log(`      - Check-in is future: ${booking.checkIn.toISOString()}`);
          }
          if (booking.checkOut <= now) {
            console.log(`      - Check-out is past: ${booking.checkOut.toISOString()}`);
          }
        }
      }
      console.log("");
    });

    // Count potential current guests
    const currentGuests = allBookings.filter(booking => 
      booking.status === "CHECKED_IN" ||
      (booking.status === "CONFIRMED" && booking.checkIn <= now && booking.checkOut > now)
    );

    console.log(`\n🏠 Current guests found: ${currentGuests.length}`);
    if (currentGuests.length > 0) {
      currentGuests.forEach(booking => {
        console.log(`   - ${booking.user.firstName} ${booking.user.lastName} in Room ${booking.room.block}-${booking.room.number} (${booking.status})`);
      });
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugBookings();
