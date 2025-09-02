import { db } from "~/utils/db.server";
import type { RoomStatus } from "@prisma/client";

/**
 * Updates the status of a room based on its current bookings
 * @param roomId - The ID of the room to update
 * @returns The new room status
 */
export async function updateRoomStatus(roomId: string): Promise<RoomStatus> {
  const now = new Date();
  
  // Get all active bookings for this room
  const activeBookings = await db.booking.findMany({
    where: {
      roomId,
      status: { in: ["CHECKED_IN", "CONFIRMED", "PENDING"] },
    },
  });

  let roomStatus: RoomStatus = "AVAILABLE";

  // Check if any booking makes the room occupied
  const isOccupied = activeBookings.some(booking => {
    // Checked in bookings always occupy the room
    if (booking.status === "CHECKED_IN") {
      return true;
    }
    
    // For confirmed/pending bookings, check if they're in their active period
    if (booking.status === "CONFIRMED" || booking.status === "PENDING") {
      return booking.checkIn <= now && booking.checkOut > now;
    }
    
    return false;
  });

  if (isOccupied) {
    roomStatus = "OCCUPIED";
  }

  // Update the room status in the database
  await db.room.update({
    where: { id: roomId },
    data: { status: roomStatus },
  });

  return roomStatus;
}

/**
 * Updates the status of all rooms based on their current bookings
 * This is useful for maintenance tasks or fixing inconsistent data
 */
export async function updateAllRoomStatuses(): Promise<void> {
  const rooms = await db.room.findMany({
    where: {
      status: { not: "MAINTENANCE" } // Don't update rooms in maintenance
    },
    select: { id: true }
  });

  // Update each room's status
  await Promise.all(
    rooms.map(room => updateRoomStatus(room.id))
  );
}

/**
 * Gets the correct room status based on bookings without updating the database
 * @param roomId - The ID of the room to check
 * @returns The correct room status
 */
export async function getRoomStatus(roomId: string): Promise<RoomStatus> {
  const now = new Date();
  
  // Get all active bookings for this room
  const activeBookings = await db.booking.findMany({
    where: {
      roomId,
      status: { in: ["CHECKED_IN", "CONFIRMED", "PENDING"] },
    },
  });

  // Check if any booking makes the room occupied
  const isOccupied = activeBookings.some(booking => {
    // Checked in bookings always occupy the room
    if (booking.status === "CHECKED_IN") {
      return true;
    }
    
    // For confirmed/pending bookings, check if they're in their active period
    if (booking.status === "CONFIRMED" || booking.status === "PENDING") {
      return booking.checkIn <= now && booking.checkOut > now;
    }
    
    return false;
  });

  return isOccupied ? "OCCUPIED" : "AVAILABLE";
}
