import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import {
  Title,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Button,
  Stack,
  Group,
  Paper,
  ActionIcon,
  Avatar,
  ThemeIcon,
  RingProgress,
  Progress,
  Container,
  Grid,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconUsers,
  IconCalendar,
  IconCurrencyDollar,
  IconTrendingUp,
  IconBed,
  IconClock,
  IconPlus,
} from "@tabler/icons-react";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { subDays, subMonths, format, differenceInDays } from "date-fns";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const roomNumber = data?.room?.number || "Unknown";
  return [
    { title: `Room ${roomNumber} - Apartment Management` },
    { name: "description", content: `View details and analytics for Room ${roomNumber}` },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const { roomId } = params;

  if (!roomId) {
    throw new Response("Room ID is required", { status: 400 });
  }

  // Get room details
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: {
      blockRelation: true,
      assets: {
        orderBy: [
          { category: "asc" },
          { name: "asc" }
        ]
      },
      bookings: {
        include: {
          user: true,
          payment: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!room) {
    throw new Response("Room not found", { status: 404 });
  }

  // Calculate analytics
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const sixMonthsAgo = subMonths(now, 6);

  // Recent bookings (last 30 days)
  const recentBookings = room.bookings.filter(
    (booking) => booking.createdAt >= thirtyDaysAgo
  );

  // All-time stats
  const totalBookings = room.bookings.length;
  const totalRevenue = room.bookings
    .filter((booking) => booking.payment?.status === "COMPLETED")
    .reduce((sum, booking) => sum + booking.totalAmount, 0);

  // Occupancy calculation (last 6 months)
  const occupancyBookings = room.bookings.filter(
    (booking) =>
      booking.checkIn >= sixMonthsAgo &&
      (booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT")
  );

  const totalDaysInPeriod = differenceInDays(now, sixMonthsAgo);
  const occupiedDays = occupancyBookings.reduce((sum, booking) => {
    const checkOut = booking.checkOut > now ? now : booking.checkOut;
    const checkIn = booking.checkIn < sixMonthsAgo ? sixMonthsAgo : booking.checkIn;
    return sum + Math.max(0, differenceInDays(checkOut, checkIn));
  }, 0);

  const occupancyRate = totalDaysInPeriod > 0 ? (occupiedDays / totalDaysInPeriod) * 100 : 0;

  // Monthly revenue trend (last 6 months)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = subMonths(now, i);
    const monthEnd = subMonths(now, i - 1);

    const monthBookings = room.bookings.filter(
      (booking) =>
        booking.createdAt >= monthStart &&
        booking.createdAt < monthEnd &&
        booking.payment?.status === "COMPLETED"
    );

    const revenue = monthBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

    monthlyRevenue.push({
      month: format(monthStart, "MMM yyyy"),
      revenue,
      bookings: monthBookings.length,
    });
  }

  // Current guest (if any)
  const currentGuest = room.bookings.find(
    (booking) =>
      booking.status === "CHECKED_IN" ||
      (booking.status === "CONFIRMED" && booking.checkIn <= now && booking.checkOut > now)
  );

  // Top guests (by number of bookings)
  interface GuestStat {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    bookings: number;
    totalSpent: number;
    lastVisit: Date;
  }

  const guestStatsRecord: Record<string, GuestStat> = {};

  room.bookings.forEach((booking) => {
    const userId = booking.userId;
    if (!guestStatsRecord[userId]) {
      guestStatsRecord[userId] = {
        user: booking.user,
        bookings: 0,
        totalSpent: 0,
        lastVisit: booking.checkIn,
      };
    }
    guestStatsRecord[userId].bookings++;
    if (booking.payment?.status === "COMPLETED") {
      guestStatsRecord[userId].totalSpent += booking.totalAmount;
    }
    if (booking.checkIn > guestStatsRecord[userId].lastVisit) {
      guestStatsRecord[userId].lastVisit = booking.checkIn;
    }
  });

  const topGuests = Object.values(guestStatsRecord)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  return json({
    user,
    room,
    analytics: {
      totalBookings,
      totalRevenue,
      occupancyRate,
      recentBookings: recentBookings.length,
      monthlyRevenue,
      currentGuest,
      topGuests,
    },
  });
}

export default function RoomDetails() {
  const { user, room, analytics } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Define types for better TypeScript support
  interface GuestStat {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    bookings: number;
    totalSpent: number;
    lastVisit: Date;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "green";
      case "OCCUPIED":
        return "blue";
      case "MAINTENANCE":
        return "orange";
      case "OUT_OF_ORDER":
        return "red";
      default:
        return "gray";
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "blue";
      case "CHECKED_IN":
        return "green";
      case "CHECKED_OUT":
        return "gray";
      case "CANCELLED":
        return "red";
      default:
        return "yellow";
    }
  };

  const formatPriceWithPeriod = (price: number, period: string) => {
    const label = period?.toLowerCase() || "night";
    return `₵${price.toLocaleString()}/${label}`;
  };

  return (
    <DashboardLayout user={user}>
      <Container size="xl">
        <Stack>
          <Group justify="space-between" >
            <Group>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => navigate("/dashboard/rooms")}
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
              <div>
                <Title order={2}>Room {room.number}</Title>
                <Text c="dimmed">
                  {room.blockRelation ? room.blockRelation.name : room.block} • Floor {room.floor}
                </Text>
              </div>
            </Group>
            <Badge size="lg" color={getStatusColor(room.status)}>
              {room.status.replace("_", " ")}
            </Badge>
          </Group>

          <Grid gutter="md" >
            {/* Room Info Card */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" p="lg" h="100%">
                <Group justify="space-between" mb="md">
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconBed size={24} />
                  </ThemeIcon>
                  <Badge variant="light">{room.type.replace("_", " ")}</Badge>
                </Group>

                <Stack gap="xs">
                  <Text size="sm">
                    <strong>Capacity:</strong> {room.capacity} guests
                  </Text>
                  <Text size="sm">
                    <strong>Price:</strong> {formatPriceWithPeriod(room.pricePerNight, room.pricingPeriod || "NIGHT")}
                  </Text>
                  <Text size="sm">
                    <strong>Block:</strong> {room.blockRelation ? room.blockRelation.name : room.block}
                  </Text>
                  <Text size="sm">
                    <strong>Floor:</strong> {room.floor}
                  </Text>
                  {room.description && (
                    <Text size="sm" c="dimmed" mt="xs">
                      {room.description}
                    </Text>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            {/* Current Occupant */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" p="lg" h="100%">
                <Group justify="space-between" mb="md">
                  <ThemeIcon size="lg" variant="light" color="green">
                    <IconUsers size={24} />
                  </ThemeIcon>
                  <Text fw={600}>Current Guest</Text>
                </Group>

                {analytics.currentGuest ? (
                  <Stack gap="xs">
                    <Group>
                      <Avatar size="sm" />
                      <div>
                        <Text size="sm" fw={500}>
                          {analytics.currentGuest.user.firstName} {analytics.currentGuest.user.lastName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {analytics.currentGuest.user.email}
                        </Text>
                      </div>
                    </Group>
                    <Text size="sm">
                      <strong>Check-in:</strong> {format(new Date(analytics.currentGuest.checkIn), "MMM dd, yyyy")}
                    </Text>
                    <Text size="sm">
                      <strong>Check-out:</strong> {format(new Date(analytics.currentGuest.checkOut), "MMM dd, yyyy")}
                    </Text>
                    <Badge size="sm" color={getBookingStatusColor(analytics.currentGuest.status)}>
                      {analytics.currentGuest.status.replace("_", " ")}
                    </Badge>
                  </Stack>
                ) : (
                  <Text c="dimmed" ta="center" py="xl">
                    No current guest
                  </Text>
                )}
              </Card>
            </Grid.Col>

            {/* Quick Stats */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" p="lg" h="100%">
                <Group justify="space-between" mb="md">
                  <ThemeIcon size="lg" variant="light" color="orange">
                    <IconTrendingUp size={24} />
                  </ThemeIcon>
                  <Text fw={600}>Quick Stats</Text>
                </Group>

                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Total Bookings</Text>
                    <Badge variant="light">{analytics.totalBookings}</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Total Revenue</Text>
                    <Text size="sm" fw={600}>₵{analytics.totalRevenue.toLocaleString()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Occupancy Rate</Text>
                    <Text size="sm" fw={600}>{analytics.occupancyRate.toFixed(1)}%</Text>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Analytics Cards */}
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} >
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Occupancy Rate</Text>
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconCalendar size={16} />
                </ThemeIcon>
              </Group>
              <Group align="center" gap="sm">
                <RingProgress
                  size={60}
                  thickness={6}
                  sections={[{ value: analytics.occupancyRate, color: 'blue' }]}
                  label={
                    <Text ta="center" size="xs" fw={700}>
                      {analytics.occupancyRate.toFixed(0)}%
                    </Text>
                  }
                />
                <div>
                  <Text fw={600} size="lg">{analytics.occupancyRate.toFixed(1)}%</Text>
                  <Text size="xs" c="dimmed">Last 6 months</Text>
                </div>
              </Group>
            </Card>

            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total Revenue</Text>
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconCurrencyDollar size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl">₵{analytics.totalRevenue.toLocaleString()}</Text>
              <Text size="xs" c="dimmed">All time</Text>
            </Card>

            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total Bookings</Text>
                <ThemeIcon size="sm" variant="light" color="orange">
                  <IconUsers size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl">{analytics.totalBookings}</Text>
              <Text size="xs" c="dimmed">All time</Text>
            </Card>

            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Recent Bookings</Text>
                <ThemeIcon size="sm" variant="light" color="violet">
                  <IconClock size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl">{analytics.recentBookings}</Text>
              <Text size="xs" c="dimmed">Last 30 days</Text>
            </Card>
          </SimpleGrid>

          {/* Revenue Trend */}
          <Card shadow="sm" p="lg" >
            <Title order={4} mb="md">Revenue Trend (Last 6 Months)</Title>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
              {analytics.monthlyRevenue.map((month) => (
                <Paper key={month.month} p="md" withBorder>
                  <Text size="xs" c="dimmed" mb={4}>{month.month}</Text>
                  <Text fw={600} size="lg">₵{month.revenue.toLocaleString()}</Text>
                  <Text size="xs" c="dimmed">{month.bookings} bookings</Text>
                  <Progress
                    value={
                      Math.max(...analytics.monthlyRevenue.map(m => m.revenue)) > 0
                        ? (month.revenue / Math.max(...analytics.monthlyRevenue.map(m => m.revenue))) * 100
                        : 0
                    }
                    size="xs"
                    mt="xs"
                    color="blue"
                  />
                </Paper>
              ))}
            </SimpleGrid>
          </Card>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Card shadow="sm" p="lg">
              <Title order={4} mb="md">Top Guests</Title>
              {analytics.topGuests.length > 0 ? (
                <Stack gap="md">
                  {(analytics.topGuests as GuestStat[]).map((guest) => (
                    <Paper key={guest.user.id} p="md" withBorder>
                      <Group justify="space-between">
                        <Group>
                          <Avatar size="md" />
                          <div>
                            <Text fw={500}>
                              {guest.user.firstName} {guest.user.lastName}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {guest.user.email}
                            </Text>
                          </div>
                        </Group>
                        <Stack gap={2} align="flex-end">
                          <Badge variant="light">{guest.bookings} bookings</Badge>
                          <Text size="sm" c="dimmed">
                            ₵{guest.totalSpent.toLocaleString()} spent
                          </Text>
                          <Text size="xs" c="dimmed">
                            Last: {format(new Date(guest.lastVisit), "MMM dd, yyyy")}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  No guest data available
                </Text>
              )}
            </Card>
            {/* Recent Bookings */}
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>Recent Bookings</Title>
                <Button
                  component={Link}
                  to="/dashboard/bookings"
                  variant="light"
                  size="xs"
                >
                  View All
                </Button>
              </Group>

              {room.bookings && room.bookings.length > 0 ? (
                <Stack gap="sm">
                  {room.bookings.slice(0, 5).map((booking: any) => (
                    <Paper key={booking.id} p="sm" withBorder>
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>
                            {booking.user.firstName} {booking.user.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {format(new Date(booking.checkIn), "MMM dd")} - {format(new Date(booking.checkOut), "MMM dd, yyyy")}
                          </Text>
                        </div>
                        <Stack gap={2} align="flex-end">
                          <Badge size="xs" color={getBookingStatusColor(booking.status)}>
                            {booking.status.replace("_", " ")}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            ₵{booking.totalAmount.toLocaleString()}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  No bookings yet
                </Text>
              )}
            </Card>
          </SimpleGrid>


          {/* Assets Section */}
          <Card shadow="sm" p="lg" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={3}>Room Assets</Title>
                <Text size="sm" c="dimmed">
                  {room.assets?.length || 0} assets in this room
                </Text>
              </div>
              {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                <Button
                  component={Link}
                  to={`/dashboard/rooms/${room.id}/assets/new`}
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                >
                  Add Asset
                </Button>
              )}
            </Group>

            {room.assets && room.assets.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
                {room.assets.map((asset) => (
                  <Card key={asset.id} withBorder p="sm">
                    <Group justify="space-between" mb="xs">
                      <Text fw={500} size="sm">{asset.name}</Text>
                      <Badge
                        color={
                          asset.condition === 'EXCELLENT' ? 'green' :
                            asset.condition === 'GOOD' ? 'blue' :
                              asset.condition === 'FAIR' ? 'yellow' :
                                asset.condition === 'POOR' ? 'orange' :
                                  asset.condition === 'DAMAGED' ? 'red' :
                                    asset.condition === 'BROKEN' ? 'red' :
                                      'gray'
                        }
                        size="xs"
                      >
                        {asset.condition}
                      </Badge>
                    </Group>

                    <Stack gap="xs">
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Category:</Text>
                        <Badge variant="light" size="xs">
                          {asset.category.replace('_', ' ')}
                        </Badge>
                      </Group>

                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Qty:</Text>
                        <Text size="xs">{asset.quantity}</Text>
                      </Group>

                      {asset.serialNumber && (
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">Serial:</Text>
                          <Text size="xs" ff="monospace">{asset.serialNumber}</Text>
                        </Group>
                      )}

                      {asset.lastInspected && (
                        <Text size="xs" c="dimmed">
                          Inspected: {new Date(asset.lastInspected).toLocaleDateString()}
                        </Text>
                      )}

                      {asset.notes && (
                        <Text size="xs" c="orange" style={{ fontStyle: 'italic' }}>
                          {asset.notes}
                        </Text>
                      )}
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            ) : (
              <Text ta="center" c="dimmed" py="xl">
                No assets found for this room.{" "}
                {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                  <Button
                    component={Link}
                    to={`/dashboard/rooms/${room.id}/assets/new`}
                    variant="light"
                    size="xs"
                    ml="sm"
                  >
                    Add the first asset
                  </Button>
                )}
              </Text>
            )}
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );
}
