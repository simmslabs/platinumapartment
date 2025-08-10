import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Title,
  Grid,
  Card,
  Text,
  Group,
  ThemeIcon,
  Stack,
  Badge,
  Progress,
  Alert,
  Button,
} from "@mantine/core";
import {
  IconBed,
  IconCalendar,
  IconUsers,
  IconCurrencyDollar,
  IconTrendingUp,
  IconAlertTriangle,
  IconClockHour2,
} from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId } from "~/utils/session.server";
import { getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard - Apartment Management" },
    { name: "description", content: "Apartment management dashboard" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Get dashboard statistics
  const [
    totalRooms,
    availableRooms,
    totalBookings,
    todayCheckIns,
    todayCheckOuts,
    pendingMaintenance,
    totalRevenue,
    criticalCheckouts,
  ] = await Promise.all([
    db.room.count(),
    db.room.count({ where: { status: "AVAILABLE" } }),
    db.booking.count({ where: { status: { not: "CANCELLED" } } }),
    db.booking.count({
      where: {
        checkIn: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: "CONFIRMED",
      },
    }),
    db.booking.count({
      where: {
        checkOut: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: "CHECKED_IN",
      },
    }),
    db.maintenanceLog.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
    db.booking.count({
      where: {
        checkOut: {
          gte: new Date(),
          lte: new Date(new Date().getTime() + 2 * 60 * 60 * 1000), // Next 2 hours
        },
        status: "CHECKED_IN",
      },
    }),
  ]);

  // Calculate occupancy rate after getting the room counts
  const occupancyRate = totalRooms > 0 ? ((totalRooms - availableRooms) / totalRooms) * 100 : 0;

  return json({
    user,
    stats: {
      totalRooms,
      availableRooms,
      occupiedRooms: totalRooms - availableRooms,
      totalBookings,
      todayCheckIns,
      todayCheckOuts,
      pendingMaintenance,
      totalRevenue: totalRevenue._sum.amount || 0,
      occupancyRate,
      criticalCheckouts,
    },
  });
}

export default function Dashboard() {
  const { user, stats } = useLoaderData<typeof loader>();

  const statCards = [
    {
      title: "Total Rooms",
      value: stats.totalRooms,
      description: `${stats.availableRooms} available`,
      icon: IconBed,
      color: "blue",
    },
    {
      title: "Today's Check-ins",
      value: stats.todayCheckIns,
      description: "Guests arriving",
      icon: IconCalendar,
      color: "green",
    },
    {
      title: "Today's Check-outs",
      value: stats.todayCheckOuts,
      description: "Guests departing",
      icon: IconUsers,
      color: "orange",
    },
    {
      title: "Total Revenue",
      value: `₵${stats.totalRevenue.toLocaleString()}`,
      description: "All time",
      icon: IconCurrencyDollar,
      color: "yellow",
    },
    {
      title: "Occupancy Rate",
      value: `${stats.occupancyRate.toFixed(1)}%`,
      description: `${stats.occupiedRooms}/${stats.totalRooms} rooms`,
      icon: IconTrendingUp,
      color: "violet",
    },
    {
      title: "Maintenance",
      value: stats.pendingMaintenance,
      description: "Pending tasks",
      icon: IconAlertTriangle,
      color: stats.pendingMaintenance > 0 ? "red" : "gray",
    },
  ];

  return (
    <DashboardLayout user={user}>
      <Stack>

        <Group justify="space-between">
          <Title order={2}>Dashboard</Title>
          <Badge size="lg" variant="light">
            {user?.role}
          </Badge>
        </Group>

        <Text c="dimmed">
          Welcome back, {user?.firstName}! Here's what's happening at your apartment complex today.
        </Text>

        {/* Critical Checkout Alert */}
        {stats.criticalCheckouts > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Critical Checkouts Alert"
            color="red"
          >
            {stats.criticalCheckouts} tenant(s) need to check out within the next 2 hours!
            <Button component={Link} to="/dashboard/monitoring" size="compact-sm" variant="white">
              View Details
            </Button>
          </Alert>
        )}

        <Grid>
          {statCards.map((stat, index) => (
            <Grid.Col key={index} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card shadow="sm" p="lg" h="100%">
                <Group justify="space-between" mb="md">
                  <ThemeIcon size="xl" variant="light" color={stat.color}>
                    <stat.icon size={24} />
                  </ThemeIcon>
                </Group>

                <Text size="xl" fw={700} mb="xs">
                  {stat.value}
                </Text>

                <Text size="sm" fw={500} mb="xs">
                  {stat.title}
                </Text>

                <Text size="xs" c="dimmed">
                  {stat.description}
                </Text>
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {stats.occupancyRate > 0 && (
          <Card shadow="sm" p="lg">
            <Title order={4} mb="md">
              Apartment Occupancy
            </Title>
            <Progress
              value={stats.occupancyRate}
              size="lg"
              radius="md"
              color={
                stats.occupancyRate > 80
                  ? "red"
                  : stats.occupancyRate > 60
                    ? "yellow"
                    : "green"
              }
            />
            <Text size="sm" c="dimmed" mt="xs">
              {stats.occupiedRooms} of {stats.totalRooms} rooms occupied ({stats.occupancyRate.toFixed(1)}%)
            </Text>
          </Card>
        )}

        {/* Quick Access Cards */}
        {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Card shadow="sm" p="lg" component={Link} to="/dashboard/reports" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Group>
                  <ThemeIcon size="xl" variant="light" color="green">
                    <IconCurrencyDollar size={24} />
                  </ThemeIcon>
                  <div>
                    <Text fw={500}>Financial Reports</Text>
                    <Text size="sm" c="dimmed">
                      View revenue analytics and guest balances
                    </Text>
                  </div>
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Card shadow="sm" p="lg" component={Link} to="/dashboard/security-deposits" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Group>
                  <ThemeIcon size="xl" variant="light" color="blue">
                    <IconAlertTriangle size={24} />
                  </ThemeIcon>
                  <div>
                    <Text fw={500}>Security Deposits</Text>
                    <Text size="sm" c="dimmed">
                      Manage deposits and process refunds
                    </Text>
                  </div>
                </Group>
              </Card>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </DashboardLayout>
  );
}
