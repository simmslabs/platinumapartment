import { db } from "./db.server";

export const softDeleteUtils = {
  /**
   * Get bookings with optional soft deletion filter
   */
  getBookings: async (options: {
    userId?: string;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  } = {}) => {
    const { userId, includeDeleted = false, onlyDeleted = false } = options;
    
    let deletedAtFilter: any;
    if (onlyDeleted) {
      deletedAtFilter = { not: null };
    } else if (!includeDeleted) {
      deletedAtFilter = null;
    }
    // If includeDeleted is true, no filter is applied

    return db.booking.findMany({
      where: {
        ...(userId && { userId }),
        ...(deletedAtFilter !== undefined && { deletedAt: deletedAtFilter }),
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        room: {
          select: { number: true, type: true, block: true, pricingPeriod: true, pricePerNight: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Soft delete a booking
   */
  softDeleteBooking: async (bookingId: string) => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.deletedAt) {
      throw new Error("Booking is already deleted");
    }

    // Only allow soft deletion of PENDING or CANCELLED bookings
    if (!["PENDING", "CANCELLED"].includes(booking.status)) {
      throw new Error("Only pending or cancelled bookings can be deleted");
    }

    const updatedBooking = await db.booking.update({
      where: { id: bookingId },
      data: { 
        deletedAt: new Date(),
        status: "CANCELLED"
      },
    });

    // Update room status if necessary
    if (booking.room.status === "OCCUPIED") {
      await db.room.update({
        where: { id: booking.roomId },
        data: { status: "AVAILABLE" },
      });
    }

    return updatedBooking;
  },

  /**
   * Restore a soft deleted booking
   */
  restoreBooking: async (bookingId: string) => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!booking.deletedAt) {
      throw new Error("Booking is not deleted");
    }

    return db.booking.update({
      where: { id: bookingId },
      data: { 
        deletedAt: null,
        status: "PENDING"
      },
    });
  },

  /**
   * Hard delete a booking (permanent)
   */
  hardDeleteBooking: async (bookingId: string) => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!booking.deletedAt) {
      throw new Error("Booking must be soft deleted before permanent deletion");
    }

    // Permanently delete the booking
    await db.booking.delete({
      where: { id: bookingId },
    });

    // Update room status if necessary
    if (booking.room.status === "OCCUPIED") {
      await db.room.update({
        where: { id: booking.roomId },
        data: { status: "AVAILABLE" },
      });
    }

    return { success: true };
  },

  /**
   * Get statistics about soft deleted bookings
   */
  getSoftDeleteStats: async () => {
    const [total, active, deleted] = await Promise.all([
      db.booking.count(),
      db.booking.count({ where: { deletedAt: null } }),
      db.booking.count({ where: { deletedAt: { not: null } } }),
    ]);

    return {
      total,
      active,
      deleted,
      deletionRate: total > 0 ? (deleted / total) * 100 : 0,
    };
  },

  /**
   * Clean up old soft deleted bookings (optional background job)
   */
  cleanupOldDeletedBookings: async (daysOld = 90) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleted = await db.booking.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });

    return deleted.count;
  },
};
