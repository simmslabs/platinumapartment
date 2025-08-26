import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Badge,
  Button,
  Stack,
  Group,
  Alert,
  Text,
  Modal,
  Textarea,
  Select,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconClock, 
  IconAlertTriangle, 
  IconCalendarTime,
  IconUser,
  IconBed,
  IconInfoCircle,
  IconMessage,
  IconPhone,
  IconBrandWhatsapp,
} from "@tabler/icons-react";
import { format, differenceInHours, differenceInMinutes, isToday, isTomorrow } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { mnotifyService } from "~/utils/mnotify.server";
import { useEffect, useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Real-time Monitoring - Apartment Management" },
    { name: "description", content: "Monitor upcoming checkouts and tenant activities" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const now = new Date();
  const next2Months = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

  // Get bookings with upcoming checkouts (include both confirmed and checked-in)
  const upcomingCheckouts = await db.booking.findMany({
    where: {
      checkOut: {
        gte: now,
        lte: next2Months,
      },
      status: { in: ["CONFIRMED", "CHECKED_IN"] }, // Include both statuses for upcoming checkouts
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      room: {
        select: { number: true, type: true },
      },
    },
    orderBy: { checkOut: "asc" },
  });

  // Get current check-ins (today)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  
  const todayCheckIns = await db.booking.findMany({
    where: {
      checkIn: {
        gte: startOfToday,
        lt: endOfToday,
      },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      room: {
        select: { number: true, type: true },
      },
    },
    orderBy: { checkIn: "asc" },
  });

  // Get overdue checkouts (include both confirmed and checked-in)
  const overdueCheckouts = await db.booking.findMany({
    where: {
      checkOut: {
        lt: now,
      },
      status: { in: ["CONFIRMED", "CHECKED_IN"] }, // Include both statuses for overdue
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      room: {
        select: { number: true, type: true },
      },
    },
    orderBy: { checkOut: "asc" },
  });

  return json({ 
    user, 
    upcomingCheckouts, 
    todayCheckIns, 
    overdueCheckouts,
    currentTime: now.toISOString(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "send-sms") {
      const phone = formData.get("phone") as string;
      const message = formData.get("message") as string;
      const type = formData.get("type") as string;

      if (!phone || !message) {
        return json({ error: "Phone number and message are required" }, { status: 400 });
      }

      let result;
      switch (type) {
        case "checkout-reminder":
          result = await mnotifyService.sendSMS({ recipient: phone, message });
          break;
        case "whatsapp":
          result = await mnotifyService.sendWhatsApp({ recipient: phone, message });
          break;
        case "voice":
          result = await mnotifyService.sendVoiceCall({ recipient: phone, message });
          break;
        default:
          result = await mnotifyService.sendSMS({ recipient: phone, message });
      }

      if (result.status === "success" || result.code === "2000") {
        return json({ success: "Notification sent successfully" });
      } else {
        console.log("MNotify API Error:", result);
        return json({ error: `Failed to send notification: ${result.message}` }, { status: 400 });
      }
    }

    if (intent === "bulk-checkout-reminders") {
      const bookingIds = JSON.parse(formData.get("bookingIds") as string);
      
      const bookings = await db.booking.findMany({
        where: { id: { in: bookingIds } },
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          room: { select: { number: true } },
        },
      });

      const guests = bookings.map(booking => ({
        phone: booking.user.phone,
        name: `${booking.user.firstName} ${booking.user.lastName}`,
        room: booking.room.number,
        time: format(new Date(booking.checkOut), "MMM dd, h:mm a"),
      }));

      const results = await mnotifyService.sendBulkCheckOutReminders(guests);
      const successCount = results.filter(r => r.status === "success" || r.code === "2000").length;
      
      return json({ 
        success: `Sent checkout reminders to ${successCount}/${guests.length} guests` 
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Notification action error:", error);
    return json({ error: "Failed to send notification. Please try again." }, { status: 500 });
  }
}

export default function Monitoring() {
  const { user, upcomingCheckouts, todayCheckIns, overdueCheckouts, currentTime } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [currentDateTime, setCurrentDateTime] = useState(new Date(currentTime));
  const [smsModalOpened, { open: openSmsModal, close: closeSmsModal }] = useDisclosure(false);
  const [selectedGuest, setSelectedGuest] = useState<{
    booking?: typeof upcomingCheckouts[0];
    messageType?: string;
  } | null>(null);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getUrgencyLevel = (checkoutDate: string) => {
    try {
      const checkout = new Date(checkoutDate);
      if (isNaN(checkout.getTime())) {
        console.error("Invalid checkout date:", checkoutDate);
        return { level: "low", color: "gray", label: "Unknown" };
      }
      
      const hoursUntil = differenceInHours(checkout, currentDateTime);
      
      if (hoursUntil <= 2) return { level: "critical", color: "red", label: "Critical" };
      if (hoursUntil <= 6) return { level: "high", color: "orange", label: "High" };
      if (hoursUntil <= 12) return { level: "medium", color: "yellow", label: "Medium" };
      return { level: "low", color: "blue", label: "Low" };
    } catch (error) {
      console.error("Error calculating urgency level:", error);
      return { level: "low", color: "gray", label: "Error" };
    }
  };

  const getTimeRemaining = (checkoutDate: string) => {
    try {
      const checkout = new Date(checkoutDate);
      if (isNaN(checkout.getTime())) {
        console.error("Invalid checkout date:", checkoutDate);
        return "Invalid date";
      }
      
      const hoursUntil = differenceInHours(checkout, currentDateTime);
      const minutesUntil = differenceInMinutes(checkout, currentDateTime) % 60;
      
      if (hoursUntil < 0) {
        // Past checkout time
        const hoursOverdue = Math.abs(hoursUntil);
        const minutesOverdue = Math.abs(minutesUntil);
        if (hoursOverdue < 1) {
          return `${minutesOverdue}m overdue`;
        } else {
          return `${hoursOverdue}h ${minutesOverdue}m overdue`;
        }
      } else if (hoursUntil < 1) {
        return `${minutesUntil} minutes`;
      } else if (hoursUntil < 24) {
        return `${hoursUntil}h ${Math.abs(minutesUntil)}m`;
      } else {
        const days = Math.floor(hoursUntil / 24);
        const remainingHours = hoursUntil % 24;
        if (days < 30) {
          return `${days}d ${remainingHours}h`;
        } else {
          const months = Math.floor(days / 30);
          const remainingDays = days % 30;
          return `${months}mo ${remainingDays}d`;
        }
      }
    } catch (error) {
      console.error("Error calculating time remaining:", error);
      return "Calculation error";
    }
  };

  const criticalCheckouts = upcomingCheckouts.filter(booking => {
    const hoursUntil = differenceInHours(new Date(booking.checkOut), currentDateTime);
    return hoursUntil <= 2 && hoursUntil >= 0; // Only include future checkouts within 2 hours
  });

  const openNotificationModal = (booking: typeof upcomingCheckouts[0], messageType: string) => {
    setSelectedGuest({
      booking,
      messageType
    });
    openSmsModal();
  };

  const sendBulkReminders = (bookings: typeof upcomingCheckouts) => {
    const bookingIds = bookings.map(b => b.id);
    const form = new FormData();
    form.append("intent", "bulk-checkout-reminders");
    form.append("bookingIds", JSON.stringify(bookingIds));
    
    fetch("/dashboard/monitoring", {
      method: "POST",
      body: form,
    }).then(() => window.location.reload());
  };

  const sendNotification = (bookings: typeof upcomingCheckouts, messageType: string, notificationType: string) => {
    if (bookings.length === 0) return;
    
    const booking = bookings[0];
    const form = new FormData();
    form.append("intent", "send-sms");
    form.append("phone", booking.user.phone);
    form.append("type", notificationType);
    
    let message = "";
    if (messageType === 'overdue_alert') {
      message = `Dear ${booking.user.firstName}, your checkout time at Unit ${booking.room.number} has passed. Please contact us immediately to arrange checkout.`;
    } else if (messageType === 'checkout_reminder') {
      message = `Dear ${booking.user.firstName}, this is a reminder that your checkout from Unit ${booking.room.number} is scheduled for ${format(new Date(booking.checkOut), "MMM dd, h:mm a")}. Please ensure you checkout on time.`;
    }
    
    form.append("message", message);
    
    fetch("/dashboard/monitoring", {
      method: "POST",
      body: form,
    }).then(() => window.location.reload());
  };

  return (
    <DashboardLayout user={user}>
      <div className="monitoring-dashboard">
        {/* Header with Real-time Updates */}
        <div className="dashboard-header">
          <div className="header-left">
            <h2 className="dashboard-title">Real-time Monitoring</h2>
            <div className="subtitle-with-stats">
              <span className="subtitle">Live apartment monitoring & notifications</span>
              <div className="quick-stats-inline">
                <span className="stat-item stat-overdue">{overdueCheckouts.length} overdue</span>
                <span className="stat-item stat-critical">{criticalCheckouts.length} critical</span>
                <span className="stat-item stat-upcoming">{upcomingCheckouts.length} upcoming</span>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="update-indicator">
              <div className="pulse-dot"></div>
              <div className="update-info">
                <span className="update-label">Live Updates</span>
                <span className="update-time">{format(currentDateTime, "HH:mm:ss")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {actionData?.error && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
            className="fade-in"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData?.success && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
            className="fade-in"
          >
            {actionData.success}
          </Alert>
        )}

        {/* Critical Alert Banner */}
        {criticalCheckouts.length > 0 && (
          <div className="critical-banner bounce-in">
            <div className="critical-content">
              <div className="critical-icon">
                <IconAlertTriangle size={24} />
              </div>
              <div className="critical-info">
                <h3>Critical Checkouts Alert</h3>
                <p>{criticalCheckouts.length} tenant(s) need to check out within 2 hours!</p>
              </div>
              <Button
                color="red"
                size="sm"
                variant="white"
                leftSection={<IconMessage size={16} />}
                onClick={() => sendBulkReminders(criticalCheckouts, 'overdue_alert')}
                className="critical-action"
              >
                Send Emergency SMS
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="monitoring-grid">
          
          {/* Overdue Checkouts Section */}
          {overdueCheckouts.length > 0 && (
            <div className="monitoring-section section-overdue">
              <div className="section-header">
                <div className="section-title-group">
                  <div className="section-icon icon-overdue">
                    <IconAlertTriangle size={20} />
                  </div>
                  <div className="section-title-info">
                    <h3 className="section-title">Overdue Checkouts</h3>
                    <span className="section-count">{overdueCheckouts.length} tenants</span>
                  </div>
                </div>
                <div className="section-actions">
                  <Button
                    color="red"
                    size="sm"
                    variant="light"
                    leftSection={<IconMessage size={14} />}
                    onClick={() => sendBulkReminders(overdueCheckouts, 'overdue_alert')}
                  >
                    Bulk Alert
                  </Button>
                </div>
              </div>
              
              <div className="booking-cards">
                {overdueCheckouts.map((booking) => {
                  const hoursOverdue = Math.abs(differenceInHours(currentDateTime, new Date(booking.checkOut)));
                  const minutesOverdue = Math.abs(differenceInMinutes(currentDateTime, new Date(booking.checkOut))) % 60;
                  const overdueDisplay = hoursOverdue > 0 ? `${hoursOverdue}h ${minutesOverdue}m` : `${minutesOverdue}m`;
                  
                  return (
                    <div key={booking.id} className="booking-card card-overdue fade-in">
                      <div className="card-status-bar"></div>
                      <div className="card-content">
                        <div className="card-main-info">
                          <div className="guest-info">
                            <div className="guest-avatar">
                              <IconUser size={20} />
                            </div>
                            <div className="guest-details">
                              <h4 className="guest-name">
                                {booking.user.firstName} {booking.user.lastName}
                              </h4>
                              <p className="guest-email">{booking.user.email}</p>
                              <div className="status-badge badge-overdue">
                                OVERDUE: {overdueDisplay}
                              </div>
                            </div>
                          </div>
                          
                          <div className="room-info">
                            <div className="info-group">
                              <span className="info-label">Room</span>
                              <span className="info-value">Unit {booking.room.number}</span>
                              <span className="info-detail">{booking.room.type.replace("_", " ")}</span>
                            </div>
                          </div>
                          
                          <div className="checkout-info">
                            <div className="info-group">
                              <span className="info-label">Expected Checkout</span>
                              <span className="info-value">{format(new Date(booking.checkOut), "MMM dd, HH:mm")}</span>
                              <span className="time-overdue">{overdueDisplay} past due</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="card-actions">
                          <div className="contact-info">
                            <span className="contact-label">Contact</span>
                            <span className="contact-number">{booking.user.phone}</span>
                          </div>
                          <div className="action-buttons">
                            <Button
                              size="xs"
                              variant="light"
                              color="blue"
                              leftSection={<IconMessage size={12} />}
                              onClick={() => openNotificationModal(booking, 'overdue_alert')}
                              className="contact-btn"
                            >
                              SMS
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              leftSection={<IconBrandWhatsapp size={12} />}
                              onClick={() => sendNotification([booking], 'overdue_alert', 'whatsapp')}
                              className="contact-btn"
                            >
                              WhatsApp
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="orange"
                              leftSection={<IconPhone size={12} />}
                              onClick={() => sendNotification([booking], 'overdue_alert', 'voice')}
                              className="contact-btn"
                            >
                              Call
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Checkouts Section */}
          <div className="monitoring-section section-upcoming">
            <div className="section-header">
              <div className="section-title-group">
                <div className="section-icon icon-upcoming">
                  <IconClock size={20} />
                </div>
                <div className="section-title-info">
                  <h3 className="section-title">Upcoming Checkouts</h3>
                  <span className="section-count">{upcomingCheckouts.length} scheduled</span>
                </div>
              </div>
              {upcomingCheckouts.length > 0 && (
                <div className="section-actions">
                  <Button
                    color="orange"
                    size="sm"
                    variant="light"
                    leftSection={<IconMessage size={14} />}
                    onClick={() => sendBulkReminders(upcomingCheckouts, 'checkout_reminder')}
                  >
                    Send Reminders
                  </Button>
                </div>
              )}
            </div>
            
            {upcomingCheckouts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <IconInfoCircle size={48} />
                </div>
                <h4>No upcoming checkouts</h4>
                <p>No checkouts scheduled in the next 2 months</p>
              </div>
            ) : (
              <div className="booking-cards">
                {upcomingCheckouts.map((booking) => {
                  const urgency = getUrgencyLevel(booking.checkOut);
                  const timeRemaining = getTimeRemaining(booking.checkOut);
                  
                  return (
                    <div 
                      key={booking.id} 
                      className={`booking-card card-upcoming urgency-${urgency.level} fade-in`}
                    >
                      <div className="card-status-bar"></div>
                      <div className="card-content">
                        <div className="card-main-info">
                          <div className="guest-info">
                            <div className="guest-avatar">
                              <IconUser size={20} />
                            </div>
                            <div className="guest-details">
                              <h4 className="guest-name">
                                {booking.user.firstName} {booking.user.lastName}
                              </h4>
                              <p className="guest-email">{booking.user.email}</p>
                              <div className={`status-badge badge-${urgency.level}`}>
                                {urgency.label} Priority
                              </div>
                            </div>
                          </div>
                          
                          <div className="room-info">
                            <div className="info-group">
                              <span className="info-label">Room</span>
                              <span className="info-value">Unit {booking.room.number}</span>
                              <span className="info-detail">{booking.room.type.replace("_", " ")}</span>
                            </div>
                          </div>
                          
                          <div className="checkout-info">
                            <div className="info-group">
                              <span className="info-label">Checkout Time</span>
                              <span className="info-value">
                                {format(new Date(booking.checkOut), "MMM dd, HH:mm")}
                              </span>
                              <span className="info-detail">
                                {isToday(new Date(booking.checkOut)) && "Today"}
                                {isTomorrow(new Date(booking.checkOut)) && "Tomorrow"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="time-remaining">
                            <div className="info-group">
                              <span className="info-label">Time Left</span>
                              <span className={`time-value time-${urgency.level}`}>{timeRemaining}</span>
                              <span className="time-unit">until checkout</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="card-actions">
                          <div className="contact-info">
                            <span className="contact-label">Contact</span>
                            <span className="contact-number">{booking.user.phone}</span>
                          </div>
                          <div className="action-buttons">
                            <Button
                              size="xs"
                              variant="light"
                              color="blue"
                              leftSection={<IconMessage size={12} />}
                              onClick={() => openNotificationModal(booking, 'checkout_reminder')}
                              className="contact-btn"
                            >
                              SMS
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              leftSection={<IconBrandWhatsapp size={12} />}
                              onClick={() => sendNotification([booking], 'checkout_reminder', 'whatsapp')}
                              className="contact-btn"
                            >
                              WhatsApp
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="orange"
                              leftSection={<IconPhone size={12} />}
                              onClick={() => sendNotification([booking], 'checkout_reminder', 'voice')}
                              className="contact-btn"
                            >
                              Call
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Check-ins Section */}
          <div className="monitoring-section section-checkins">
            <div className="section-header">
              <div className="section-title-group">
                <div className="section-icon icon-checkins">
                  <IconCalendarTime size={20} />
                </div>
                <div className="section-title-info">
                  <h3 className="section-title">Today&apos;s Check-ins</h3>
                  <span className="section-count">{todayCheckIns.length} arrivals</span>
                </div>
              </div>
            </div>
            
            {todayCheckIns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <IconInfoCircle size={48} />
                </div>
                <h4>No check-ins today</h4>
                <p>No arrivals scheduled for today</p>
              </div>
            ) : (
              <div className="booking-cards">
                {todayCheckIns.map((booking) => {
                  const checkOutTime = new Date(booking.checkOut);
                  const hoursUntilCheckOut = differenceInHours(checkOutTime, currentDateTime);
                  const minutesUntilCheckOut = differenceInMinutes(checkOutTime, currentDateTime) % 60;
                  
                  let timeDisplay, timeStatus, timeColor;
                  if (hoursUntilCheckOut > 24) {
                    const days = Math.floor(hoursUntilCheckOut / 24);
                    const remainingHours = hoursUntilCheckOut % 24;
                    timeDisplay = days > 0 ? `${days}d ${remainingHours}h` : `${hoursUntilCheckOut}h`;
                    timeStatus = "until checkout";
                    timeColor = "blue";
                  } else if (hoursUntilCheckOut > 0) {
                    timeDisplay = `${hoursUntilCheckOut}h ${Math.abs(minutesUntilCheckOut)}m`;
                    timeStatus = "until checkout";
                    timeColor = hoursUntilCheckOut <= 6 ? "orange" : "blue";
                  } else if (hoursUntilCheckOut === 0 && minutesUntilCheckOut > 0) {
                    timeDisplay = `${minutesUntilCheckOut}m`;
                    timeStatus = "until checkout";
                    timeColor = "orange";
                  } else {
                    const hoursOverdue = Math.abs(hoursUntilCheckOut);
                    const minutesOverdue = Math.abs(minutesUntilCheckOut);
                    timeDisplay = hoursOverdue > 0 ? `${hoursOverdue}h ${minutesOverdue}m` : `${minutesOverdue}m`;
                    timeStatus = "overdue";
                    timeColor = "red";
                  }

                  return (
                    <div key={booking.id} className="booking-card card-checkin fade-in">
                      <div className="card-status-bar"></div>
                      <div className="card-content">
                        <div className="card-main-info">
                          <div className="guest-info">
                            <div className="guest-avatar">
                              <IconUser size={20} />
                            </div>
                            <div className="guest-details">
                              <h4 className="guest-name">
                                {booking.user.firstName} {booking.user.lastName}
                              </h4>
                              <p className="guest-email">{booking.user.email}</p>
                              <div className={`status-badge badge-${booking.status === "CHECKED_IN" ? "checked-in" : "confirmed"}`}>
                                {booking.status === "CHECKED_IN" ? "Checked In" : "Confirmed"}
                              </div>
                            </div>
                          </div>
                          
                          <div className="room-info">
                            <div className="info-group">
                              <span className="info-label">Room</span>
                              <span className="info-value">Unit {booking.room.number}</span>
                              <span className="info-detail">{booking.room.type.replace("_", " ")}</span>
                            </div>
                          </div>
                          
                          <div className="checkin-info">
                            <div className="info-group">
                              <span className="info-label">Check-in</span>
                              <span className="info-value">
                                {(() => {
                                  const checkInDate = new Date(booking.checkIn);
                                  const timeStr = format(checkInDate, "HH:mm");
                                  if (timeStr === "00:00") {
                                    return "3:00 PM";
                                  }
                                  return format(checkInDate, "h:mm a");
                                })()}
                              </span>
                              <span className="info-detail">
                                {isToday(new Date(booking.checkIn)) ? "Today" : format(new Date(booking.checkIn), "MMM dd")}
                              </span>
                            </div>
                          </div>
                          
                          <div className="checkout-countdown">
                            <div className="info-group">
                              <span className="info-label">Until Checkout</span>
                              <span className={`time-value time-${timeColor}`}>{timeDisplay}</span>
                              <span className="time-unit">{timeStatus}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="card-actions">
                          <div className="contact-info">
                            <span className="contact-label">Contact</span>
                            <span className="contact-number">{booking.user.phone}</span>
                          </div>
                          <div className="action-buttons">
                            <Button
                              size="xs"
                              variant="light"
                              color={timeColor === 'red' ? 'red' : 'blue'}
                              leftSection={<IconMessage size={12} />}
                              onClick={() => openNotificationModal(booking, timeColor === 'red' ? 'overdue_alert' : 'checkout_reminder')}
                              className="contact-btn"
                            >
                              SMS
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              leftSection={<IconBrandWhatsapp size={12} />}
                              onClick={() => sendNotification([booking], timeColor === 'red' ? 'overdue_alert' : 'checkout_reminder', 'whatsapp')}
                              className="contact-btn"
                            >
                              WhatsApp
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="orange"
                              leftSection={<IconPhone size={12} />}
                              onClick={() => sendNotification([booking], timeColor === 'red' ? 'overdue_alert' : 'checkout_reminder', 'voice')}
                              className="contact-btn"
                            >
                              Call
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="stats-dashboard">
          <h3 className="stats-title">Quick Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card stat-overdue">
              <div className="stat-icon">
                <IconAlertTriangle size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-number">{overdueCheckouts.length}</span>
                <span className="stat-label">Overdue Checkouts</span>
              </div>
            </div>
            
            <div className="stat-card stat-critical">
              <div className="stat-icon">
                <IconClock size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-number">{criticalCheckouts.length}</span>
                <span className="stat-label">Critical (2h)</span>
              </div>
            </div>
            
            <div className="stat-card stat-upcoming">
              <div className="stat-icon">
                <IconBed size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-number">{upcomingCheckouts.length}</span>
                <span className="stat-label">Upcoming (2mo)</span>
              </div>
            </div>
            
            <div className="stat-card stat-checkins">
              <div className="stat-icon">
                <IconUser size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-number">{todayCheckIns.length}</span>
                <span className="stat-label">Today&apos;s Check-ins</span>
              </div>
            </div>
          </div>
        </div>

        {/* SMS Notification Modal */}
        <Modal opened={smsModalOpened} onClose={closeSmsModal} title="Send SMS Notification" size="lg">
          {selectedGuest && (
            <Form method="post">
              <input type="hidden" name="intent" value="send-sms" />
              <input type="hidden" name="phone" value={selectedGuest.booking?.user?.phone} />
              <input type="hidden" name="type" value="sms" />
              <Stack>
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  title="Guest Information"
                  color="blue"
                  variant="light"
                >
                  <Text size="sm">
                    Guest: {selectedGuest.booking?.user?.firstName} {selectedGuest.booking?.user?.lastName}
                  </Text>
                  <Text size="sm">
                    Room: Unit {selectedGuest.booking?.room?.number}
                  </Text>
                  <Text size="sm">
                    Phone: {selectedGuest.booking?.user?.phone}
                  </Text>
                </Alert>

                <Select
                  label="Message Type"
                  name="messageType"
                  value={selectedGuest.messageType || 'checkout_reminder'}
                  data={[
                    { value: 'checkout_reminder', label: 'Checkout Reminder' },
                    { value: 'overdue_alert', label: 'Overdue Alert' },
                    { value: 'custom', label: 'Custom Message' },
                  ]}
                  required
                />

                <Textarea
                  label="Message"
                  name="message"
                  placeholder="Enter your message here..."
                  defaultValue={
                    selectedGuest.messageType === 'overdue_alert'
                      ? `Dear ${selectedGuest.booking?.user?.firstName}, your checkout time at Unit ${selectedGuest.booking?.room?.number} has passed. Please contact us immediately to arrange checkout.`
                      : `Dear ${selectedGuest.booking?.user?.firstName}, this is a reminder that your checkout from Unit ${selectedGuest.booking?.room?.number} is scheduled for ${selectedGuest.booking?.checkOut ? format(new Date(selectedGuest.booking.checkOut), "MMM dd, h:mm a") : ''}. Please ensure you checkout on time.`
                  }
                  rows={4}
                  required
                />

                <Group justify="flex-end">
                  <Button variant="outline" onClick={closeSmsModal}>
                    Cancel
                  </Button>
                  <Button type="submit" onClick={closeSmsModal}>
                    Send SMS
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
