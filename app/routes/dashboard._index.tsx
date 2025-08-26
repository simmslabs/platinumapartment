import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Title,
  Card,
  Text,
  Group,
  ThemeIcon,
  Stack,
  Badge,
  Progress,
  Alert,
  Button,
  Center,
  SimpleGrid,
  Paper,
} from "@mantine/core";
import { AreaChart, DonutChart, BarChart } from "@mantine/charts";
import {
  IconBed,
  IconCalendar,
  IconUsers,
  IconCurrencyDollar,
  IconTrendingUp,
  IconAlertTriangle,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard - Apartment Management" },
    { name: "description", content: "Apartment management dashboard" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

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

  // Get room type distribution for donut chart
  const roomTypes = await db.room.groupBy({
    by: ['typeId'],
    _count: {
      id: true,
    },
  });

  // Get room type details for chart labels
  const roomTypeDetails = await db.roomType.findMany({
    where: {
      id: {
        in: roomTypes.map(rt => rt.typeId)
      }
    }
  });

  // Get last 7 days booking activity for area chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const weeklyActivity = await Promise.all(
    last7Days.map(async (date) => {
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const [checkIns, checkOuts] = await Promise.all([
        db.booking.count({
          where: {
            checkIn: { gte: dayStart, lte: dayEnd },
            status: { not: "CANCELLED" },
          },
        }),
        db.booking.count({
          where: {
            checkOut: { gte: dayStart, lte: dayEnd },
            status: { not: "CANCELLED" },
          },
        }),
      ]);

      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        checkIns,
        checkOuts,
      };
    })
  );

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
    chartData: {
      roomTypes: roomTypes.map(rt => {
        const typeDetail = roomTypeDetails.find(td => td.id === rt.typeId);
        return {
          name: typeDetail?.displayName || 'Unknown',
          value: rt._count?.id || 0,
          color: typeDetail?.name.includes('ONE_BEDROOM') ? '#37b24d' :
                 typeDetail?.name.includes('TWO_BEDROOM') ? '#f59f00' :
                 typeDetail?.name.includes('STANDARD') ? '#1c7ed6' : 
                 typeDetail?.name.includes('SPECIAL') ? '#e03131' : '#868e96'
        };
      }),
      weeklyActivity,
    },
  });
}

export default function Dashboard() {
  const { user, stats, chartData } = useLoaderData<typeof loader>();

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
          Welcome back, {user?.firstName}! Here&apos;s what&apos;s happening at your apartment complex today.
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

        <SimpleGrid cols={{ base: 1, sm: 6, lg: 4 }} spacing="md">
          {statCards.slice(0, 2).map((stat, index) => (
            <Card key={index} shadow="sm" p="lg" h="100%">
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
          ))}
        </SimpleGrid>

        {/* Today's Activity Bar Chart */}
        <Paper withBorder p="lg" radius="md">
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} size="lg">Today&apos;s Check-in/Check-out Activity</Text>
              <Text size="sm" c="dimmed">Real-time guest movement</Text>
            </div>
            <Group>
              <Badge color="green" variant="light">{stats.todayCheckIns} Check-ins</Badge>
              <Badge color="orange" variant="light">{stats.todayCheckOuts} Check-outs</Badge>
            </Group>
          </Group>
          <BarChart
            h={120}
            data={[
              { activity: 'Check-ins', count: stats.todayCheckIns, color: 'green.6' },
              { activity: 'Check-outs', count: stats.todayCheckOuts, color: 'orange.6' },
            ]}
            dataKey="activity"
            series={[
              { name: 'count', color: 'blue.6' }
            ]}
            withLegend={false}
            gridAxis="none"
            tickLine="none"
          />
        </Paper>        {/* Analytics Charts Section */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {/* Room Types Donut Chart */}
          <Paper withBorder p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={600} size="lg">Room Types</Text>
                <Text size="sm" c="dimmed">Distribution by type</Text>
              </div>
              <ThemeIcon size="xl" variant="light" color="blue">
                <IconBed size={24} />
              </ThemeIcon>
            </Group>
            <Center>
              <DonutChart
                data={chartData.roomTypes}
                size={160}
                thickness={30}
                tooltipDataSource="segment"
                withTooltip
              />
            </Center>
            <Text ta="center" size="sm" mt="md">
              {stats.totalRooms} total rooms
            </Text>
          </Paper>

          {/* Weekly Activity Area Chart */}
          <Paper withBorder p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={600} size="lg">Weekly Activity</Text>
                <Text size="sm" c="dimmed">Check-ins vs Check-outs</Text>
              </div>
              <ThemeIcon size="xl" variant="light" color="green">
                <IconCalendar size={24} />
              </ThemeIcon>
            </Group>
            <AreaChart
              h={160}
              data={chartData.weeklyActivity}
              dataKey="date"
              series={[
                { name: 'checkIns', label: 'Check-ins', color: 'green.6' },
                { name: 'checkOuts', label: 'Check-outs', color: 'orange.6' },
              ]}
              curveType="linear"
              withGradient
              strokeWidth={2}
              fillOpacity={0.2}
            />
          </Paper>

          {/* Occupancy & Revenue Metrics */}
          <Paper withBorder p="lg" radius="md">
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={600} size="lg">Key Metrics</Text>
                <Text size="sm" c="dimmed">Performance overview</Text>
              </div>
              <ThemeIcon size="xl" variant="light" color="violet">
                <IconTrendingUp size={24} />
              </ThemeIcon>
            </Group>
            <Stack gap="lg">
              <div>
                <Group justify="space-between" align="center" mb="xs">
                  <Text fw={500}>Occupancy Rate</Text>
                  <Text fw={700} c={stats.occupancyRate > 80 ? 'red' : stats.occupancyRate > 60 ? 'yellow' : 'green'}>
                    {stats.occupancyRate.toFixed(1)}%
                  </Text>
                </Group>
                <Progress
                  value={stats.occupancyRate}
                  color={stats.occupancyRate > 80 ? 'red' : stats.occupancyRate > 60 ? 'yellow' : 'green'}
                  size="lg"
                  radius="md"
                />
              </div>
              <div>
                <Text size="xl" fw={700} c="green">
                  ₵{stats.totalRevenue.toLocaleString()}
                </Text>
                <Text size="sm" c="dimmed">Total Revenue</Text>
              </div>
              <div>
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={500}>Maintenance</Text>
                    <Text size="sm" c="dimmed">{stats.pendingMaintenance} pending</Text>
                  </div>
                  <Badge 
                    color={stats.pendingMaintenance > 5 ? 'red' : stats.pendingMaintenance > 0 ? 'yellow' : 'green'}
                    variant="light"
                    size="lg"
                  >
                    {stats.pendingMaintenance === 0 ? 'All Clear' : `${stats.pendingMaintenance} Tasks`}
                  </Badge>
                </Group>
              </div>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Quick Access Cards */}
        {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
          </SimpleGrid>
        )}
      </Stack>
    </DashboardLayout>
  );
}
