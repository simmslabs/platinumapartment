import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { emailService } from "~/utils/email.server";
import { mnotifyService } from "~/utils/mnotify.server";
import { format, isAfter, isBefore } from "date-fns";

type BookingWithRelations = {
  id: string;
  status: string;
  userId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  room: {
    id: string;
    number: string;
  };
};

export async function action({ request }: ActionFunctionArgs) {
  // Verify this is a POST request
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Get authorization header for basic security
    const authHeader = request.headers.get("Authorization");
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const results = {
      processed: 0,
      emailsSent: 0,
      smsSent: 0,
      staffNotified: 0,
      notifiedGuests: [] as Array<{ name: string; room: string }>,
      errors: [] as string[],
    };

    // Find bookings that are currently active (checked in) and at 75% completion
    const activeBookings = await db.booking.findMany({
      where: {
        status: "CHECKED_IN",
        checkIn: {
          lte: now, // Already checked in
        },
        checkOut: {
          gte: now, // Not yet checked out
        },
      },
      include: {
        user: true,
        room: true,
      },
    }) as BookingWithRelations[];

    for (const booking of activeBookings) {
      try {
        results.processed++;

        const checkInDate = new Date(booking.checkIn);
        const checkOutDate = new Date(booking.checkOut);
        const totalStayDuration = checkOutDate.getTime() - checkInDate.getTime();
        const seventyFivePercentDuration = totalStayDuration * 0.75;
        const seventyFivePercentDate = new Date(checkInDate.getTime() + seventyFivePercentDuration);

        // Check if today is the 75% completion date (within a 2-hour window)
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        if (
          isAfter(seventyFivePercentDate, twoHoursAgo) &&
          isBefore(seventyFivePercentDate, twoHoursFromNow)
        ) {
          // Check if we've already sent notifications for this booking today
          const existingNotification = await db.notification.findFirst({
            where: {
              bookingId: booking.id,
              type: "SEVENTY_FIVE_PERCENT_STAY",
              createdAt: {
                gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), // Today
              },
            },
          });

          if (!existingNotification) {
            // Prepare notification content
            const guestName = `${booking.user.firstName} ${booking.user.lastName}`;
            const roomNumber = booking.room.number;
            const checkOutDateFormatted = format(checkOutDate, "MMMM dd, yyyy 'at' hh:mm a");
            const remainingDays = Math.ceil((checkOutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            const emailSubject = "Your Stay is Almost Complete - Platinum Apartment";
            const emailContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">🏨 Your Stay Progress</h2>
                <p>Dear ${guestName},</p>
                
                <p>We hope you're enjoying your stay at Platinum Apartment! We wanted to remind you that you've completed 75% of your reservation.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Booking Details:</h3>
                  <p><strong>Room:</strong> ${roomNumber}</p>
                  <p><strong>Check-out Date:</strong> ${checkOutDateFormatted}</p>
                  <p><strong>Remaining Days:</strong> ${remainingDays} day${remainingDays !== 1 ? 's' : ''}</p>
                </div>
                
                <p>Here are a few reminders for your departure:</p>
                <ul>
                  <li>Check-out time is 11:00 AM</li>
                  <li>Please ensure all personal belongings are packed</li>
                  <li>Room key should be returned at the front desk</li>
                  <li>Any outstanding charges will be processed automatically</li>
                </ul>
                
                <p>If you need to extend your stay or have any questions, please contact our front desk at any time.</p>
                
                <p>Thank you for choosing Platinum Apartment!</p>
                
                <p style="color: #6b7280; font-size: 14px;">
                  Best regards,<br>
                  The Platinum Apartment Team
                </p>
              </div>
            `;

            const smsContent = `Hi ${booking.user.firstName}! You've completed 75% of your stay at Platinum Apartment (Room ${roomNumber}). Check-out is on ${checkOutDateFormatted}. Thank you for staying with us! - Platinum Apartment`;

            // Send email notification
            if (booking.user.email) {
              try {
                await emailService.sendCustomEmail({
                  to: booking.user.email,
                  subject: emailSubject,
                  html: emailContent,
                });
                results.emailsSent++;
              } catch (emailError) {
                console.error(`Failed to send email to ${booking.user.email}:`, emailError);
                const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
                results.errors.push(`Email failed for booking ${booking.id}: ${errorMessage}`);
              }
            }

            // Send SMS notification
            if (booking.user.phone) {
              try {
                const result = await mnotifyService.sendSMS({
                  recipient: booking.user.phone,
                  message: smsContent,
                });
                
                if (result.status === "success" || result.code === "2000") {
                  results.smsSent++;
                } else {
                  console.error(`MNotify SMS failed for ${booking.user.phone}:`, result);
                  results.errors.push(`SMS failed for booking ${booking.id}: ${result.message}`);
                }
              } catch (smsError) {
                console.error(`Failed to send SMS to ${booking.user.phone}:`, smsError);
                const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
                results.errors.push(`SMS failed for booking ${booking.id}: ${errorMessage}`);
              }
            }

            // Log the notification in the database
            await db.notification.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                type: "SEVENTY_FIVE_PERCENT_STAY",
                title: "75% Stay Completion Notice",
                message: `Stay completion notification sent for Room ${roomNumber}`,
                channel: booking.user.phone ? "EMAIL_SMS" : "EMAIL",
                status: "SENT",
              },
            });

            // Track guest who received notification
            results.notifiedGuests.push({
              name: guestName,
              room: roomNumber,
            });
          }
        }
      } catch (bookingError) {
        console.error(`Error processing booking ${booking.id}:`, bookingError);
        const errorMessage = bookingError instanceof Error ? bookingError.message : String(bookingError);
        results.errors.push(`Booking ${booking.id}: ${errorMessage}`);
      }
    }

    // Send summary notifications to all staff users (always send, even if no guests were notified)
    try {
        // Get all staff users (admins, managers, staff)
        const staffUsers = await db.user.findMany({
          where: {
            role: { in: ["ADMIN", "MANAGER", "STAFF"] },
            phone: { not: null },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        });

        // Create a list of guests who actually received notifications
        const notifiedGuestsList = results.notifiedGuests
          .map(guest => `${guest.name} (Room ${guest.room})`)
          .join(", ");

        const summaryMessage = results.notifiedGuests.length > 0 
          ? `🏨 Platinum Apartment Alert: ${results.notifiedGuests.length} guest(s) received 75% stay completion notifications. Guests notified: ${notifiedGuestsList}. Sent: ${results.emailsSent} emails, ${results.smsSent} SMS.`
          : `🏨 Platinum Apartment: No guests required 75% stay completion notifications at this time.`;

        // Send SMS to all staff members
        for (const staff of staffUsers) {
          if (staff.phone) {
            try {
              const result = await mnotifyService.sendSMS({
                recipient: staff.phone,
                message: `Hi ${staff.firstName}, ${summaryMessage}`,
              });

              if (result.status === "success" || result.code === "2000") {
                results.smsSent++;
                results.staffNotified++;
              } else {
                console.error(`Staff SMS failed for ${staff.phone}:`, result);
                results.errors.push(`Staff SMS failed for ${staff.firstName}: ${result.message}`);
              }
            } catch (staffSmsError) {
              console.error(`Failed to send staff SMS to ${staff.phone}:`, staffSmsError);
              const errorMessage = staffSmsError instanceof Error ? staffSmsError.message : String(staffSmsError);
              results.errors.push(`Staff SMS failed for ${staff.firstName}: ${errorMessage}`);
            }
          }
        }
      } catch (staffError) {
        console.error("Error sending staff notifications:", staffError);
        const errorMessage = staffError instanceof Error ? staffError.message : String(staffError);
        results.errors.push(`Staff notifications error: ${errorMessage}`);
      }

    return json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });

  } catch (error) {
    console.error("Cron job error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return json(
      { 
        error: "Internal server error", 
        details: errorMessage,
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}

// Handle GET requests for testing purposes (only in development)
export async function loader() {
  if (process.env.NODE_ENV !== "development") {
    return json({ error: "Not found" }, { status: 404 });
  }

  return json({
    message: "Cron notifications endpoint",
    usage: "POST request with Authorization header",
    environment: process.env.NODE_ENV,
  });
}
