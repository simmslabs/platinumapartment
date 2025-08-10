import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Title,
  Badge,
  Button,
  Stack,
  Group,
  Alert,
  Text,
  Card,
  Progress,
  ThemeIcon,
  Grid,
  Center,
  Modal,
  Textarea,
  Select,
  ActionIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { 
  IconClock, 
  IconAlertTriangle, 
  IconCalendarTime,
  IconUser,
  IconBed,
  IconInfoCircle,
  IconClockHour2,
  IconMessage,
  IconPhone,
  IconMessageCircle,
  IconBrandWhatsapp,
} from "@tabler/icons-react";
import { format, differenceInHours, differenceInMinutes, isToday, isTomorrow } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { mnotifyService } from "~/utils/mnotify.server";
import type { Booking, Room, User } from "@prisma/client";
import { useEffect, useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Real-time Monitoring - Apartment Management" },
    { name: "description", content: "Monitor upcoming checkouts and tenant activities" },
  ];
};

type BookingWithDetails = Booking & {
  user: Pick<User, "firstName" | "lastName" | "email" | "phone">;
  room: Pick<Room, "number" | "type">;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
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

  // Debug logging to help identify issues
  console.log("Monitoring Dashboard Debug:", {
    now: now.toISOString(),
    next2Months: next2Months.toISOString(),
    upcomingCheckoutsCount: upcomingCheckouts.length,
    overdueCheckoutsCount: overdueCheckouts.length,
    todayCheckInsCount: todayCheckIns.length,
    sampleUpcomingCheckout: upcomingCheckouts[0] ? {
      id: upcomingCheckouts[0].id,
      checkOut: upcomingCheckouts[0].checkOut,
      status: upcomingCheckouts[0].status,
      user: upcomingCheckouts[0].user.firstName + " " + upcomingCheckouts[0].user.lastName
    } : null
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
  } catch (error: any) {
    console.error("Notification action error:", error);
    return json({ error: "Failed to send notification. Please try again." }, { status: 500 });
  }
}

export default function Monitoring() {
  const { user, upcomingCheckouts, todayCheckIns, overdueCheckouts, currentTime } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [currentDateTime, setCurrentDateTime] = useState(new Date(currentTime));
  const [smsModalOpened, { open: openSmsModal, close: closeSmsModal }] = useDisclosure(false);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);

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

  const openNotificationModal = (booking: any, messageType: string) => {
    setSelectedGuest({
      booking,
      messageType
    });
    openSmsModal();
  };

  const sendBulkReminders = (bookings: any[], messageType: string = 'checkout_reminder') => {
    const bookingIds = bookings.map(b => b.id);
    const form = new FormData();
    form.append("intent", "bulk-checkout-reminders");
    form.append("bookingIds", JSON.stringify(bookingIds));
    
    fetch("/dashboard/monitoring", {
      method: "POST",
      body: form,
    }).then(() => window.location.reload());
  };

  const sendNotification = (bookings: any[], messageType: string, notificationType: string) => {
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
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Real-time Monitoring</Title>
          <Group>
            <ThemeIcon color="blue" variant="light">
              <IconClockHour2 size={16} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Last updated: {format(currentDateTime, "HH:mm:ss")}
            </Text>
          </Group>
        </Group>

        {actionData?.error && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData?.success && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
          >
            {actionData.success}
          </Alert>
        )}

        {/* Critical Alerts */}
        {criticalCheckouts.length > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Critical Checkouts Alert"
            color="red"
            action={
              <Button
                color="red"
                size="xs"
                variant="white"
                onClick={() => sendBulkReminders(criticalCheckouts, 'overdue_alert')}
              >
                Send SMS Reminders
              </Button>
            }
          >
            {criticalCheckouts.length} tenant(s) need to check out within 2 hours!
          </Alert>
        )}

        {/* Overdue Checkouts */}
        {overdueCheckouts.length > 0 && (
          <Card>
            <Group mb="md">
              <ThemeIcon color="red" size="lg">
                <IconAlertTriangle size={20} />
              </ThemeIcon>
              <Title order={3} c="red">Overdue Checkouts ({overdueCheckouts.length})</Title>
              {overdueCheckouts.length > 0 && (
                <Button
                  color="red"
                  size="xs"
                  variant="light"
                  leftSection={<IconMessage size={14} />}
                  onClick={() => sendBulkReminders(overdueCheckouts, 'overdue_alert')}
                  ml="auto"
                >
                  Send Bulk SMS
                </Button>
              )}
            </Group>
            <Stack gap="md">
              {overdueCheckouts.map((booking) => {
                const hoursOverdue = Math.abs(differenceInHours(currentDateTime, new Date(booking.checkOut)));
                const minutesOverdue = Math.abs(differenceInMinutes(currentDateTime, new Date(booking.checkOut))) % 60;
                const overdueDisplay = hoursOverdue > 0 ? `${hoursOverdue}h ${minutesOverdue}m` : `${minutesOverdue}m`;
                return (
                  <Card key={booking.id} withBorder p="md" style={{ borderLeft: "4px solid #fa5252" }}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Group gap="lg" wrap="nowrap">
                          <div>
                            <Text fw={600} size="sm" c="red">OVERDUE</Text>
                            <Text fw={500}>
                              {booking.user.firstName} {booking.user.lastName}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {booking.user.email}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">UNIT</Text>
                            <Text fw={500}>Unit {booking.room.number}</Text>
                            <Text size="sm" c="dimmed">
                              {booking.room.type.replace("_", " ")}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">EXPECTED CHECKOUT</Text>
                            <Text fw={500}>{format(new Date(booking.checkOut), "MMM dd, HH:mm")}</Text>
                            <Badge color="red" size="sm">
                              {overdueDisplay} overdue
                            </Badge>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">DURATION OVERDUE</Text>
                            <Text fw={700} size="lg" c="red">
                              {overdueDisplay}
                            </Text>
                            <Text size="xs" c="red">past due</Text>
                          </div>
                        </Group>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Text size="xs" c="dimmed">CONTACT</Text>
                        <Text size="sm" fw={500}>{booking.user.phone}</Text>
                        <Group gap="xs" mt="xs">
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            leftSection={<IconMessage size={12} />}
                            onClick={() => openNotificationModal(booking, 'overdue_alert')}
                          >
                            SMS
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            leftSection={<IconBrandWhatsapp size={12} />}
                            onClick={() => sendNotification([booking], 'overdue_alert', 'whatsapp')}
                          >
                            WhatsApp
                          </Button>
                        </Group>
                      </div>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          </Card>
        )}

        {/* Upcoming Checkouts */}
        <Card>
          <Group mb="md">
            <ThemeIcon color="orange" size="lg">
              <IconClock size={20} />
            </ThemeIcon>
            <Title order={3}>Upcoming Checkouts ({upcomingCheckouts.length})</Title>
            {upcomingCheckouts.length > 0 && (
              <Button
                color="orange"
                size="xs"
                variant="light"
                leftSection={<IconMessage size={14} />}
                onClick={() => sendBulkReminders(upcomingCheckouts, 'checkout_reminder')}
                ml="auto"
              >
                Send Reminders
              </Button>
            )}
          </Group>
          
          {upcomingCheckouts.length === 0 ? (
            <Center p="xl">
              <Stack align="center">
                <IconInfoCircle size={48} color="gray" />
                <Text c="dimmed">No upcoming checkouts in the next 2 months</Text>
                <Text size="xs" c="dimmed">
                  This includes both confirmed and checked-in bookings
                </Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="md">
              {upcomingCheckouts.map((booking) => {
                const urgency = getUrgencyLevel(booking.checkOut);
                const timeRemaining = getTimeRemaining(booking.checkOut);
                return (
                  <Card 
                    key={booking.id} 
                    withBorder 
                    p="md" 
                    style={{ 
                      borderLeft: `4px solid var(--mantine-color-${urgency.color}-6)`,
                      backgroundColor: urgency.level === "critical" ? "var(--mantine-color-red-0)" : undefined
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Group gap="lg" wrap="nowrap">
                          <div>
                            <Badge color={urgency.color} size="sm" mb="xs">
                              {urgency.label}
                            </Badge>
                            <Text fw={500}>
                              {booking.user.firstName} {booking.user.lastName}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {booking.user.email}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">UNIT</Text>
                            <Text fw={500}>Unit {booking.room.number}</Text>
                            <Text size="sm" c="dimmed">
                              {booking.room.type.replace("_", " ")}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">CHECKOUT TIME</Text>
                            <Text fw={500}>
                              {format(new Date(booking.checkOut), "MMM dd, HH:mm")}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {isToday(new Date(booking.checkOut)) && "Today"}
                              {isTomorrow(new Date(booking.checkOut)) && "Tomorrow"}
                            </Text>
                          </div>
                          <div>
                            <Text size="xs" c="dimmed">TIME REMAINING</Text>
                            <Text fw={700} size="lg" c={urgency.color}>
                              {timeRemaining}
                            </Text>
                            <Text size="xs" c={urgency.color}>until checkout</Text>
                          </div>
                        </Group>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Text size="xs" c="dimmed">CONTACT</Text>
                        <Text size="sm" fw={500}>{booking.user.phone}</Text>
                        <Group gap="xs" mt="xs" justify="center">
                          <Button
                            size="xs"
                            variant="light"
                            color="blue"
                            leftSection={<IconMessage size={12} />}
                            onClick={() => openNotificationModal(booking, 'checkout_reminder')}
                          >
                            SMS
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            leftSection={<IconBrandWhatsapp size={12} />}
                            onClick={() => sendNotification([booking], 'checkout_reminder', 'whatsapp')}
                          >
                            WhatsApp
                          </Button>
                        </Group>
                        <div style={{ marginTop: "8px", textAlign: "center" }}>
                          <Text size="xs" c="dimmed">TIME LEFT</Text>
                          <Badge color={urgency.color} size="lg" variant="filled">
                            {timeRemaining}
                          </Badge>
                        </div>
                      </div>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Card>

        {/* Today's Check-ins */}
        <Card>
          <Group mb="md">
            <ThemeIcon color="green" size="lg">
              <IconCalendarTime size={20} />
            </ThemeIcon>
            <Title order={3}>Today's Check-ins</Title>
          </Group>
          
          {todayCheckIns.length === 0 ? (
            <Center p="xl">
              <Stack align="center">
                <IconInfoCircle size={48} color="gray" />
                <Text c="dimmed">No check-ins scheduled for today</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="md">
              {todayCheckIns.map((booking) => {
                // Calculate time until checkout
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
                <Card 
                  key={booking.id} 
                  withBorder 
                  p="md" 
                  style={{ 
                    borderLeft: "4px solid var(--mantine-color-green-6)",
                    backgroundColor: "var(--mantine-color-green-0)"
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Group gap="lg" wrap="nowrap">
                        <div>
                          <Badge 
                            color={booking.status === "CHECKED_IN" ? "blue" : "green"} 
                            size="sm" 
                            mb="xs"
                          >
                            {booking.status === "CHECKED_IN" ? "Checked In" : "Confirmed"}
                          </Badge>
                          <Text fw={500}>
                            {booking.user.firstName} {booking.user.lastName}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {booking.user.email}
                          </Text>
                        </div>
                        <div>
                          <Text size="xs" c="dimmed">UNIT</Text>
                          <Text fw={500}>Unit {booking.room.number}</Text>
                          <Text size="sm" c="dimmed">
                            {booking.room.type.replace("_", " ")}
                          </Text>
                        </div>
                        <div>
                          <Text size="xs" c="dimmed">CHECK-IN</Text>
                          <Text fw={500}>
                            {(() => {
                              const checkInDate = new Date(booking.checkIn);
                              const timeStr = format(checkInDate, "HH:mm");
                              // If time is 00:00 (midnight), show default check-in time
                              if (timeStr === "00:00") {
                                return "3:00 PM";
                              }
                              // Format the time nicely
                              return format(checkInDate, "h:mm a");
                            })()}
                          </Text>
                          <Text size="sm" c="green">
                            {isToday(new Date(booking.checkIn)) ? "Today" : format(new Date(booking.checkIn), "MMM dd")}
                          </Text>
                        </div>
                        <div>
                          <Text size="xs" c="dimmed">TIME TO CHECKOUT</Text>
                          <Text fw={700} size="lg" c={timeColor}>
                            {timeDisplay}
                          </Text>
                          <Text size="xs" c={timeColor}>{timeStatus}</Text>
                        </div>
                      </Group>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" c="dimmed">CONTACT</Text>
                      <Text size="sm" fw={500}>{booking.user.phone}</Text>
                      <Group gap="xs" mt="xs" justify="center">
                          <Button
                            size="xs"
                            variant="light"
                            color={timeColor === 'red' ? 'red' : 'blue'}
                            leftSection={<IconMessage size={12} />}
                            onClick={() => openNotificationModal(booking, timeColor === 'red' ? 'overdue_alert' : 'checkout_reminder')}
                          >
                            SMS
                          </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="green"
                          leftSection={<IconBrandWhatsapp size={12} />}
                          onClick={() => sendNotification([booking], timeColor === 'red' ? 'overdue_alert' : 'checkout_reminder', 'whatsapp')}
                        >
                          WhatsApp
                        </Button>
                      </Group>
                      <div style={{ marginTop: "8px", textAlign: "center" }}>
                        <Badge color={timeColor} size="lg" variant="filled">
                          {timeDisplay}
                        </Badge>
                        <Text size="xs" c={timeColor} mt={2}>{timeStatus}</Text>
                      </div>
                    </div>
                  </Group>
                </Card>
              );
              })}
            </Stack>
          )}
        </Card>

        {/* Quick Stats */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <ThemeIcon color="red" size="lg">
                  <IconAlertTriangle size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>{overdueCheckouts.length}</Text>
                  <Text size="sm" c="dimmed">Overdue</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <ThemeIcon color="orange" size="lg">
                  <IconClock size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>{criticalCheckouts.length}</Text>
                  <Text size="sm" c="dimmed">Critical (2h)</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <ThemeIcon color="blue" size="lg">
                  <IconBed size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>{upcomingCheckouts.length}</Text>
                  <Text size="sm" c="dimmed">Upcoming (2mo)</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card>
              <Group>
                <ThemeIcon color="green" size="lg">
                  <IconUser size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xl" fw={700}>{todayCheckIns.length}</Text>
                  <Text size="sm" c="dimmed">Today's Check-ins</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

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
      </Stack>
    </DashboardLayout>
  );
}
