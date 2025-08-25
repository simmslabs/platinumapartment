import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/utils/db.server";
import { emailService } from "~/utils/email.server";
import { mnotifyService } from "~/utils/mnotify.server";
import { format, differenceInDays } from "date-fns";

export async function action({ request }: ActionFunctionArgs) {
  // Verify this is a cron request (you might want to add authentication)
  const url = new URL(request.url);
  const cronKey = url.searchParams.get("key");
  
  if (cronKey !== process.env.CRON_SECRET_KEY) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    
    // Find all active bookings
    const activeBookings = await db.booking.findMany({
      where: {
        status: {
          in: ["CONFIRMED", "CHECKED_IN"]
        },
        checkIn: {
          lte: now
        },
        checkOut: {
          gte: now
        }
      },
      include: {
        user: true,
        room: {
          include: {
            blockRelation: true
          }
        }
      }
    });

    const notifications: Array<{
      bookingId: string;
      guest: string;
      room: string;
      block: string;
      checkOut: string;
      daysRemaining: number;
      completionPercentage: number;
      phoneNumber: string;
    }> = [];
    
    const smsResults: Array<{
      success: boolean;
      guest: string;
      phone: string;
      room: string;
      error?: string;
    }> = [];
    
    for (const booking of activeBookings) {
      const totalDays = differenceInDays(booking.checkOut, booking.checkIn);
      const daysElapsed = differenceInDays(now, booking.checkIn);
      const completionPercentage = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
      
      // Check if guest has completed 75% or more of their stay
      if (completionPercentage >= 75) {
        const daysRemaining = differenceInDays(booking.checkOut, now);
        
        // Send SMS to guest if they have a phone number
        if (booking.user.phone) {
          try {
            const checkOutTime = format(booking.checkOut, 'MMM dd, yyyy');
            const result = await mnotifyService.sendCheckOutReminder(
              booking.user.phone,
              booking.user.firstName,
              booking.room.number,
              checkOutTime
            );
            
            if (result.status === 'success' || result.code === '2000') {
              smsResults.push({
                success: true,
                guest: `${booking.user.firstName} ${booking.user.lastName}`,
                phone: booking.user.phone,
                room: booking.room.number
              });
            } else {
              throw new Error(result.message || 'SMS sending failed');
            }
          } catch (error) {
            console.error(`Failed to send SMS to ${booking.user.phone}:`, error);
            smsResults.push({
              success: false,
              guest: `${booking.user.firstName} ${booking.user.lastName}`,
              phone: booking.user.phone,
              room: booking.room.number,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Create notification record for tracking
        await db.notification.create({
          data: {
            userId: booking.user.id,
            title: "Checkout Reminder",
            message: `Your stay in Room ${booking.room.number} ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
            type: "SEVENTY_FIVE_PERCENT_STAY",
            channel: booking.user.phone ? "EMAIL_SMS" : "EMAIL",
            status: "SENT",
            bookingId: booking.id,
            sentAt: now
          }
        });

        notifications.push({
          bookingId: booking.id,
          guest: `${booking.user.firstName} ${booking.user.lastName}`,
          room: booking.room.number,
          block: booking.room.blockRelation?.name || booking.room.block,
          checkOut: format(booking.checkOut, 'MMM dd, yyyy'),
          daysRemaining,
          completionPercentage: Math.round(completionPercentage),
          phoneNumber: booking.user.phone || 'No phone number'
        });
      }
    }

    // Notify staff/admin users about the checkout reminders sent
    if (notifications.length > 0) {
      const staffUsers = await db.user.findMany({
        where: {
          role: {
            in: ["ADMIN", "MANAGER", "STAFF"]
          }
        }
      });

      const staffNotificationMessage = `Checkout reminder notifications sent to ${notifications.length} guest${notifications.length !== 1 ? 's' : ''}:\n\n${notifications.map(n => `• ${n.guest} - Room ${n.room} (${n.daysRemaining} day${n.daysRemaining !== 1 ? 's' : ''} remaining)`).join('\n')}`;

      // Create notifications for staff
      for (const staff of staffUsers) {
        await db.notification.create({
          data: {
            userId: staff.id,
            title: "Daily Checkout Reminders Sent",
            message: staffNotificationMessage,
            type: "GENERAL_ANNOUNCEMENT",
            channel: "EMAIL",
            status: "SENT",
            sentAt: now
          }
        });
      }

      // Send email summary to staff (optional)
      try {
        const emailSubject = `Daily Checkout Reminders - ${format(now, 'MMM dd, yyyy')}`;
        const emailContent = `
          <h2>Daily Checkout Reminder Summary</h2>
          <p>The following guests have been notified about their upcoming checkout (75%+ stay completed):</p>
          
          <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th>Guest Name</th>
                <th>Room</th>
                <th>Block</th>
                <th>Checkout Date</th>
                <th>Days Remaining</th>
                <th>Stay Completion</th>
                <th>SMS Status</th>
              </tr>
            </thead>
            <tbody>
              ${notifications.map(n => {
                const smsResult = smsResults.find(s => s.room === n.room);
                const smsStatus = n.phoneNumber === 'No phone number' ? 'No phone' : 
                                 smsResult?.success ? 'Sent' : 'Failed';
                return `
                  <tr>
                    <td>${n.guest}</td>
                    <td>${n.room}</td>
                    <td>${n.block}</td>
                    <td>${n.checkOut}</td>
                    <td>${n.daysRemaining}</td>
                    <td>${n.completionPercentage}%</td>
                    <td>${smsStatus}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <p><strong>SMS Summary:</strong></p>
          <ul>
            <li>Successful SMS: ${smsResults.filter(s => s.success).length}</li>
            <li>Failed SMS: ${smsResults.filter(s => !s.success).length}</li>
            <li>No phone number: ${notifications.filter(n => n.phoneNumber === 'No phone number').length}</li>
          </ul>
        `;

        for (const staff of staffUsers) {
          try {
            await emailService.sendCustomEmail({
              to: staff.email,
              subject: emailSubject,
              html: emailContent
            });
          } catch (emailError) {
            console.error(`Failed to send notification email to ${staff.email}:`, emailError);
          }
        }
      } catch (error) {
        console.error('Failed to send staff notification emails:', error);
      }
    }

    return json({
      success: true,
      message: `Checkout reminder cron completed successfully`,
      summary: {
        totalActiveBookings: activeBookings.length,
        notificationsSent: notifications.length,
        smsSuccessful: smsResults.filter(s => s.success).length,
        smsFailed: smsResults.filter(s => !s.success).length,
        timestamp: now.toISOString()
      },
      notifications,
      smsResults
    });

  } catch (error) {
    console.error('Checkout reminder cron error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Handle GET requests for testing
export async function loader() {
  return json({
    message: "Checkout reminder cron endpoint",
    usage: "POST with ?key=CRON_SECRET_KEY",
    description: "Sends SMS and notifications to guests who have completed 75% of their stay duration"
  });
}
