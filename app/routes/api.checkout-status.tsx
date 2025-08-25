import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";

export async function loader() {
  console.log('API: checkout-status endpoint called');
  try {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));

    console.log('API: Querying database for checkout counts...');

    // Count overdue checkouts (should have checked out but haven't)
    const overdueCount = await db.booking.count({
      where: {
        checkOut: {
          lt: now,
        },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    });

    // Count upcoming checkouts (next 2 hours)
    const upcomingCount = await db.booking.count({
      where: {
        checkOut: {
          gte: now,
          lte: twoHoursFromNow,
        },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    });

    // Count today's checkouts for additional context
    const todayCheckOuts = await db.booking.count({
      where: {
        checkOut: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: endOfToday,
        },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    });

    const result = {
      overdueCount,
      upcomingCount,
      todayCheckOuts,
      totalCritical: overdueCount + upcomingCount,
    };

    console.log('API: Checkout status result:', result);

    return json(result);
  } catch (error) {
    console.error("Failed to fetch checkout status:", error);
    return json(
      { error: "Failed to fetch checkout status" },
      { status: 500 }
    );
  }
}
