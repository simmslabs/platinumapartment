import { db } from "./app/utils/db.server";

async function debugCurrentGuest() {
  // Get all rooms with their bookings
  const rooms = await db.room.findMany({
    include: {
      bookings: {
        include: {
          user: true,
          payment: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  const now = new Date();
  console.log("Current time:", now.toISOString());
  console.log("\n=== Checking all rooms for current guests ===\n");

  for (const room of rooms) {
    console.log(`Room ${room.number} (${room.id}):`);
    console.log(`  Status: ${room.status}`);
    console.log(`  Total bookings: ${room.bookings.length}`);
    
    if (room.bookings.length === 0) {
      console.log("  No bookings found");
      continue;
    }

    // Check for current guest using the same logic as the loader
    const currentGuest = room.bookings.find(
      (booking) =>
        booking.status === "CHECKED_IN" ||
        (booking.status === "CONFIRMED" && booking.checkIn <= now && booking.checkOut > now)
    );

    if (currentGuest) {
      console.log(`  ✅ Current guest found: ${currentGuest.user.firstName} ${currentGuest.user.lastName}`);
      console.log(`     Status: ${currentGuest.status}`);
      console.log(`     Check-in: ${currentGuest.checkIn.toISOString()}`);
      console.log(`     Check-out: ${currentGuest.checkOut.toISOString()}`);
      console.log(`     Payment status: ${currentGuest.payment?.status || 'No payment'}`);
    } else {
      console.log("  ❌ No current guest");
      
      // Show recent bookings for debugging
      const recentBookings = room.bookings.slice(0, 3);
      if (recentBookings.length > 0) {
        console.log("     Recent bookings:");
        recentBookings.forEach((booking, index) => {
          console.log(`     ${index + 1}. ${booking.user.firstName} ${booking.user.lastName}`);
          console.log(`        Status: ${booking.status}`);
          console.log(`        Check-in: ${booking.checkIn.toISOString()}`);
          console.log(`        Check-out: ${booking.checkOut.toISOString()}`);
          console.log(`        Payment: ${booking.payment?.status || 'No payment'}`);
          
          // Check why this booking doesn't qualify as current guest
          const isCheckedIn = booking.status === "CHECKED_IN";
          const isConfirmedAndActive = booking.status === "CONFIRMED" && booking.checkIn <= now && booking.checkOut > now;
          console.log(`        Qualifies as current guest: ${isCheckedIn || isConfirmedAndActive}`);
          if (!isCheckedIn && !isConfirmedAndActive) {
            if (booking.status !== "CONFIRMED") {
              console.log(`        - Status is ${booking.status}, not CONFIRMED or CHECKED_IN`);
            } else {
              if (booking.checkIn > now) {
                console.log(`        - Check-in is in the future (${booking.checkIn.toISOString()})`);
              }
              if (booking.checkOut <= now) {
                console.log(`        - Check-out is in the past (${booking.checkOut.toISOString()})`);
              }
            }
          }
        });
      }
    }
    console.log("");
  }
}

debugCurrentGuest()
  .then(() => {
    console.log("Debug complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
