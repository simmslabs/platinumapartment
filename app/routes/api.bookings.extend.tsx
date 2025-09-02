import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { mnotifyService } from "~/utils/mnotify.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const bookingId = formData.get("bookingId") as string;
    const extensionPeriods = parseInt(formData.get("extensionPeriods") as string);
    const reason = formData.get("reason") as string;
    const paymentMethod = formData.get("paymentMethod") as string || "CASH";
    const paymentAccount = formData.get("paymentAccount") as string || "";

    if (!bookingId || !extensionPeriods || extensionPeriods <= 0) {
      return json({ error: "Booking ID and valid extension periods are required" }, { status: 400 });
    }

    // Get the booking with room information
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        user: true,
        payment: true,
      },
    });

    if (!booking) {
      return json({ error: "Booking not found" }, { status: 404 });
    }

    // Check if booking is eligible for extension (checked in or confirmed)
    if (!["CHECKED_IN", "CONFIRMED"].includes(booking.status)) {
      return json({ error: "Only confirmed or checked-in bookings can be extended" }, { status: 400 });
    }

    // Calculate new checkout date based on room's pricing period
    const currentCheckOut = new Date(booking.checkOut);
    let newCheckOut: Date;
    
    switch (booking.room.pricingPeriod) {
      case 'DAY':
      case 'NIGHT':
        newCheckOut = addDays(currentCheckOut, extensionPeriods);
        break;
      case 'WEEK':
        newCheckOut = addWeeks(currentCheckOut, extensionPeriods);
        break;
      case 'MONTH':
        newCheckOut = addMonths(currentCheckOut, extensionPeriods);
        break;
      case 'YEAR':
        newCheckOut = addYears(currentCheckOut, extensionPeriods);
        break;
      default:
        newCheckOut = addDays(currentCheckOut, extensionPeriods);
    }

    // Calculate additional amount
    const additionalAmount = booking.room.pricePerNight * extensionPeriods;
    const newTotalAmount = booking.totalAmount + additionalAmount;

    // Update the booking in a transaction
    const updatedBooking = await db.$transaction(async (tx) => {
      // Update the booking
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          checkOut: newCheckOut,
          totalAmount: newTotalAmount,
          specialRequests: booking.specialRequests 
            ? `${booking.specialRequests}\n\n[EXTENSION] ${format(new Date(), "yyyy-MM-dd")}: Extended by ${extensionPeriods} ${booking.room.pricingPeriod?.toLowerCase() || 'day'}(s). Reason: ${reason || 'No reason provided'}`
            : `[EXTENSION] ${format(new Date(), "yyyy-MM-dd")}: Extended by ${extensionPeriods} ${booking.room.pricingPeriod?.toLowerCase() || 'day'}(s). Reason: ${reason || 'No reason provided'}`,
        },
        include: {
          user: true,
          room: true,
        },
      });

      // Create a new payment record for the extension if there's additional amount
      if (additionalAmount > 0) {
        await tx.payment.upsert({
          where: { bookingId: bookingId },
          update: {
            amount: { increment: additionalAmount },
            method: paymentMethod as "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "ONLINE" | "BANK_TRANSFER" | "MOBILE_MONEY" | "PAYPAL" | "STRIPE" | "VISA" | "MASTERCARD",
            notes: `Extended payment: +₵${additionalAmount} for ${extensionPeriods} ${booking.room.pricingPeriod?.toLowerCase() || 'day'}(s)${paymentAccount ? `. Account: ${paymentAccount}` : ''}`,
          },
          create: {
            bookingId: bookingId,
            amount: additionalAmount,
            method: paymentMethod as "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "ONLINE" | "BANK_TRANSFER" | "MOBILE_MONEY" | "PAYPAL" | "STRIPE" | "VISA" | "MASTERCARD",
            status: "PENDING",
            notes: `Rent extension - ${extensionPeriods} ${booking.room.pricingPeriod?.toLowerCase() || 'day'}(s)${paymentAccount ? `. Account: ${paymentAccount}` : ''}`,
          },
        });

        // Create a transaction record for financial tracking
        await tx.transaction.create({
          data: {
            transactionNumber: `TXN-${Date.now()}-${bookingId.slice(-4)}`,
            type: "PAYMENT",
            amount: additionalAmount,
            fee: 0,
            netAmount: additionalAmount,
            method: paymentMethod as "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "ONLINE" | "BANK_TRANSFER" | "MOBILE_MONEY" | "PAYPAL" | "STRIPE" | "VISA" | "MASTERCARD",
            description: `Rent extension payment for Room ${booking.room.number} - ${extensionPeriods} ${booking.room.pricingPeriod?.toLowerCase() || 'day'}(s)`,
            bookingId: bookingId,
            userId: booking.userId,
            status: "PENDING",
            metadata: JSON.stringify({
              extensionPeriods,
              paymentAccount: paymentAccount || null,
              reason: reason || "Rent period extension",
              roomNumber: booking.room.number,
            }),
          },
        });
      }

      // Create notification for the tenant
      await tx.notification.create({
        data: {
          userId: booking.userId,
          bookingId: bookingId,
          type: "PAYMENT_RECEIVED",
          title: "Rent Period Extended",
          message: `Your rent period for Room ${booking.room.number} has been extended until ${format(newCheckOut, "MMM dd, yyyy")}. Additional amount: ₵${additionalAmount.toFixed(2)}`,
          isRead: false,
        },
      });

      return updated;
    });

    // Send SMS notifications (don't block the response if SMS fails)
    try {
      // Send SMS to guest if they have a phone number
      if (booking.user.phone) {
        await mnotifyService.sendRentExtensionAlert(
          booking.user.phone,
          booking.user.name,
          booking.room.number,
          format(newCheckOut, "MMM dd, yyyy"),
          extensionPeriods,
          booking.room.pricingPeriod || "DAY",
          additionalAmount,
          paymentMethod
        );
        console.log(`Rent extension SMS sent to guest: ${booking.user.phone}`);
      }

      // Send SMS alert to admin/manager for rent extension
      const adminPhone = process.env.ADMIN_PHONE || process.env.MANAGER_PHONE;
      if (adminPhone) {
        await mnotifyService.sendRentExtensionAdminAlert(
          adminPhone,
          booking.user.name,
          booking.room.number,
          format(newCheckOut, "MMM dd, yyyy"),
          extensionPeriods,
          booking.room.pricingPeriod || "DAY",
          additionalAmount,
          paymentMethod,
          bookingId
        );
        console.log(`Rent extension admin SMS sent to: ${adminPhone}`);
      }
    } catch (smsError) {
      console.error("Failed to send rent extension SMS:", smsError);
      // Don't fail the extension if SMS fails
    }

    return json({
      success: true,
      booking: updatedBooking,
      message: `Rent extended successfully until ${format(newCheckOut, "MMM dd, yyyy")}`,
      additionalAmount,
    });

  } catch (error) {
    console.error("Rent extension error:", error);
    return json({ error: "Failed to extend rent period" }, { status: 500 });
  }
}
