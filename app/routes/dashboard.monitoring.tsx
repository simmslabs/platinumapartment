import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
} from "@mantine/core";
import { 
  IconClock, 
  IconAlertTriangle, 
  IconCalendarTime,
  IconUser,
  IconBed,
  IconInfoCircle,
  IconClockHour2,
} from "@tabler/icons-react";
import { format, differenceInHours, differenceInMinutes, isToday, isTomorrow } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
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
  const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Get bookings with upcoming checkouts
  const upcomingCheckouts = await db.booking.findMany({
    where: {
      checkOut: {
        gte: now,
        lte: next48Hours,
      },
      status: "CHECKED_IN",
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

  // Get overdue checkouts
  const overdueCheckouts = await db.booking.findMany({
    where: {
      checkOut: {
        lt: now,
      },
      status: "CHECKED_IN",
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

export default function Monitoring() {
  const { user, upcomingCheckouts, todayCheckIns, overdueCheckouts, currentTime } = useLoaderData<typeof loader>();
  const [currentDateTime, setCurrentDateTime] = useState(new Date(currentTime));

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getUrgencyLevel = (checkoutDate: string) => {
    const checkout = new Date(checkoutDate);
    const hoursUntil = differenceInHours(checkout, currentDateTime);
    
    if (hoursUntil <= 2) return { level: "critical", color: "red", label: "Critical" };
    if (hoursUntil <= 6) return { level: "high", color: "orange", label: "High" };
    if (hoursUntil <= 12) return { level: "medium", color: "yellow", label: "Medium" };
    return { level: "low", color: "blue", label: "Low" };
  };

  const getTimeRemaining = (checkoutDate: string) => {
    const checkout = new Date(checkoutDate);
    const hoursUntil = differenceInHours(checkout, currentDateTime);
    const minutesUntil = differenceInMinutes(checkout, currentDateTime) % 60;
    
    if (hoursUntil < 1) {
      return `${minutesUntil} minutes`;
    }
    return `${hoursUntil}h ${minutesUntil}m`;
  };

  const criticalCheckouts = upcomingCheckouts.filter(booking => 
    differenceInHours(new Date(booking.checkOut), currentDateTime) <= 2
  );

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

        {/* Critical Alerts */}
        {criticalCheckouts.length > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Critical Checkouts Alert"
            color="red"
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
            <Title order={3}>Upcoming Checkouts (Next 48 Hours)</Title>
          </Group>
          
          {upcomingCheckouts.length === 0 ? (
            <Center p="xl">
              <Stack align="center">
                <IconInfoCircle size={48} color="gray" />
                <Text c="dimmed">No upcoming checkouts in the next 48 hours</Text>
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
                // Calculate time until/since check-in
                const checkInTime = new Date(booking.checkIn);
                // If check-in time is 00:00, set it to 3:00 PM (15:00)
                if (checkInTime.getHours() === 0 && checkInTime.getMinutes() === 0) {
                  checkInTime.setHours(15, 0, 0, 0);
                }
                const hoursUntilCheckIn = differenceInHours(checkInTime, currentDateTime);
                const minutesUntilCheckIn = differenceInMinutes(checkInTime, currentDateTime) % 60;
                
                let timeDisplay, timeStatus, timeColor;
                if (hoursUntilCheckIn > 0) {
                  timeDisplay = `${hoursUntilCheckIn}h ${Math.abs(minutesUntilCheckIn)}m`;
                  timeStatus = "until check-in";
                  timeColor = "blue";
                } else if (hoursUntilCheckIn === 0 && minutesUntilCheckIn > 0) {
                  timeDisplay = `${minutesUntilCheckIn}m`;
                  timeStatus = "until check-in";
                  timeColor = "blue";
                } else {
                  const hoursSince = Math.abs(hoursUntilCheckIn);
                  const minutesSince = Math.abs(minutesUntilCheckIn);
                  timeDisplay = hoursSince > 0 ? `${hoursSince}h ${minutesSince}m` : `${minutesSince}m`;
                  timeStatus = "check-in ready";
                  timeColor = "green";
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
                          <Text size="xs" c="dimmed">TIME STATUS</Text>
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
                  <Text size="sm" c="dimmed">Upcoming (48h)</Text>
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
      </Stack>
    </DashboardLayout>
  );
}
