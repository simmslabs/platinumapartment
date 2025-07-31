import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Title,
  Card,
  Text,
  Stack,
  Group,
  ThemeIcon,
  Progress,
  SimpleGrid,
  Badge,
} from "@mantine/core";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconBed,
  IconCurrencyDollar,
  IconCalendar,
} from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Analytics - Apartment Management" },
    { name: "description", content: "Apartment analytics and reports" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Get current month data
  const currentDate = new Date();
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  
  // Get previous month data for comparison
  const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

  const [
    // Current month stats
    currentMonthBookings,
    currentMonthRevenue,
    currentMonthGuests,
    
    // Previous month stats for comparison
    previousMonthBookings,
    previousMonthRevenue,
    
    // Overall stats
    totalRooms,
    occupiedRooms,
    totalGuests,
    averageRating,
    
    // Room type distribution
    roomTypeStats,
    
    // Recent bookings
    recentBookings,
    
    // Payment method distribution
    paymentStats,
  ] = await Promise.all([
    // Current month
    db.booking.count({
      where: {
        createdAt: { gte: currentMonth, lt: nextMonth },
        status: { not: "CANCELLED" },
      },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: currentMonth, lt: nextMonth },
        status: "COMPLETED",
      },
    }),
    db.user.count({
      where: {
        createdAt: { gte: currentMonth, lt: nextMonth },
        role: "GUEST",
      },
    }),
    
    // Previous month
    db.booking.count({
      where: {
        createdAt: { gte: previousMonth, lt: currentMonth },
        status: { not: "CANCELLED" },
      },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: previousMonth, lt: currentMonth },
        status: "COMPLETED",
      },
    }),
    
    // Overall
    db.room.count(),
    db.room.count({ where: { status: "OCCUPIED" } }),
    db.user.count({ where: { role: "GUEST" } }),
    db.review.aggregate({ _avg: { rating: true } }),
    
    // Room type stats
    db.room.groupBy({
      by: ["type"],
      _count: { type: true },
    }),
    
    // Recent bookings
    db.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true } },
        room: { select: { number: true } },
      },
    }),
    
    // Payment methods
    db.payment.groupBy({
      by: ["method"],
      _count: { method: true },
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
  ]);

  // Calculate changes
  const bookingsChange = previousMonthBookings > 0 
    ? ((currentMonthBookings - previousMonthBookings) / previousMonthBookings) * 100 
    : 0;
  
  const revenueChange = (previousMonthRevenue._sum.amount || 0) > 0 
    ? (((currentMonthRevenue._sum.amount || 0) - (previousMonthRevenue._sum.amount || 0)) / (previousMonthRevenue._sum.amount || 1)) * 100 
    : 0;

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  return json({
    user,
    stats: {
      currentMonth: {
        bookings: currentMonthBookings,
        revenue: currentMonthRevenue._sum.amount || 0,
        guests: currentMonthGuests,
      },
      changes: {
        bookings: bookingsChange,
        revenue: revenueChange,
      },
      overall: {
        totalRooms,
        occupiedRooms,
        occupancyRate,
        totalGuests,
        averageRating: averageRating._avg.rating || 0,
      },
      roomTypes: roomTypeStats,
      recentBookings,
      paymentMethods: paymentStats,
    },
  });
}

export default function Analytics() {
  const { user, stats } = useLoaderData<typeof loader>();

  const formatChange = (change: number) => {
    const isPositive = change >= 0;
    return {
      value: Math.abs(change).toFixed(1),
      color: isPositive ? "green" : "red",
      icon: isPositive ? IconTrendingUp : IconTrendingDown,
    };
  };

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Title order={2}>Analytics & Reports</Title>

        {/* Key Metrics */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Card shadow="sm" p="lg">
            <Group justify="space-between" mb="md">
              <ThemeIcon size="xl" variant="light" color="blue">
                <IconCalendar size={24} />
              </ThemeIcon>
              <div style={{ textAlign: "right" }}>
                {(() => {
                  const change = formatChange(stats.changes.bookings);
                  return (
                    <Group gap="xs" justify="flex-end">
                      <change.icon size={16} color={change.color} />
                      <Text size="sm" c={change.color}>
                        {change.value}%
                      </Text>
                    </Group>
                  );
                })()}
              </div>
            </Group>
            <Text size="xl" fw={700} mb="xs">
              {stats.currentMonth.bookings}
            </Text>
            <Text size="sm" c="dimmed">
              Bookings this month
            </Text>
          </Card>

          <Card shadow="sm" p="lg">
            <Group justify="space-between" mb="md">
              <ThemeIcon size="xl" variant="light" color="green">
                <IconCurrencyDollar size={24} />
              </ThemeIcon>
              <div style={{ textAlign: "right" }}>
                {(() => {
                  const change = formatChange(stats.changes.revenue);
                  return (
                    <Group gap="xs" justify="flex-end">
                      <change.icon size={16} color={change.color} />
                      <Text size="sm" c={change.color}>
                        {change.value}%
                      </Text>
                    </Group>
                  );
                })()}
              </div>
            </Group>
            <Text size="xl" fw={700} mb="xs">
              ₵{stats.currentMonth.revenue.toLocaleString()}
            </Text>
            <Text size="sm" c="dimmed">
              Revenue this month
            </Text>
          </Card>

          <Card shadow="sm" p="lg">
            <Group justify="space-between" mb="md">
              <ThemeIcon size="xl" variant="light" color="violet">
                <IconBed size={24} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={700} mb="xs">
              {stats.overall.occupancyRate.toFixed(1)}%
            </Text>
            <Text size="sm" c="dimmed">
              Occupancy rate
            </Text>
            <Progress 
              value={stats.overall.occupancyRate} 
              size="sm" 
              mt="xs"
              color={stats.overall.occupancyRate > 80 ? "red" : stats.overall.occupancyRate > 60 ? "yellow" : "green"}
            />
          </Card>

          <Card shadow="sm" p="lg">
            <Group justify="space-between" mb="md">
              <ThemeIcon size="xl" variant="light" color="orange">
                <IconUsers size={24} />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={700} mb="xs">
              {stats.overall.totalGuests}
            </Text>
            <Text size="sm" c="dimmed">
              Total guests
            </Text>
          </Card>
        </SimpleGrid>

        {/* Room Type Distribution */}
        <Card shadow="sm" p="lg">
          <Title order={4} mb="md">
            Room Type Distribution
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {stats.roomTypes.map((roomType) => (
              <div key={roomType.type}>
                <Text fw={500} mb="xs">
                  {roomType.type.replace("_", " ")}
                </Text>
                <Text size="xl" fw={700} c="blue">
                  {roomType._count.type}
                </Text>
                <Text size="sm" c="dimmed">
                  rooms
                </Text>
              </div>
            ))}
          </SimpleGrid>
        </Card>

        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          {/* Recent Bookings */}
          <Card shadow="sm" p="lg" h="100%">
            <Title order={4} mb="md">
              Recent Bookings
            </Title>
            <Stack gap="sm">
              {stats.recentBookings.map((booking) => (
                <Group key={booking.id} justify="space-between">
                  <div>
                    <Text fw={500}>
                      {booking.user.firstName} {booking.user.lastName}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Room {booking.room.number}
                    </Text>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge size="sm" color="green">
                      ₵{booking.totalAmount}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {booking.status}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </Card>

          {/* Payment Methods */}
          <Card shadow="sm" p="lg" h="100%">
            <Title order={4} mb="md">
              Payment Methods
            </Title>
            <Stack gap="sm">
              {stats.paymentMethods.map((payment) => (
                <Group key={payment.method} justify="space-between">
                  <div>
                    <Text fw={500}>
                      {payment.method.replace("_", " ")}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {payment._count.method} transactions
                    </Text>
                  </div>
                  <Text fw={700} c="green">
                    ₵{(payment._sum.amount || 0).toLocaleString()}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </DashboardLayout>
  );
}
