import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useNavigate, Outlet, useLocation, Form, useActionData } from "@remix-run/react";
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
  Modal,
  Alert,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconUsers,
  IconCalendar,
  IconCurrencyDollar,
  IconTrendingUp,
  IconBed,
  IconClock,
  IconPlus,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { subDays, subMonths, format, differenceInDays } from "date-fns";
import { useState } from "react";

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
      type: {
        select: {
          displayName: true,
          name: true,
        },
      },
      blockRelation: true,
      assets: {
        include: {
          asset: true, // Include the actual asset details
        },
        orderBy: [
          { assignedAt: "asc" }, // Order by when asset was assigned
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

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const { roomId } = params;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (!roomId) {
    throw new Response("Room ID required", { status: 400 });
  }

  try {
    if (intent === "force-delete") {
      const confirmation = formData.get("confirm") as string;
      
      if (confirmation !== "DELETE") {
        return json({ error: "Confirmation text must be 'DELETE'" }, { status: 400 });
      }

      // Check if room exists
      const room = await db.room.findUnique({
        where: { id: roomId },
        include: {
          bookings: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } },
          assets: true,
          maintenance: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
        },
      });

      if (!room) {
        return json({ error: "Room not found" }, { status: 404 });
      }

      // Force delete: Remove all related data
      await db.$transaction(async (tx) => {
        // Delete room assets first
        await tx.roomAsset.deleteMany({
          where: { roomId },
        });

        // Delete maintenance logs
        await tx.maintenanceLog.deleteMany({
          where: { roomId },
        });

        // Delete bookings and related data
        const bookings = await tx.booking.findMany({
          where: { roomId },
          select: { id: true },
        });

        if (bookings.length > 0) {
          const bookingIds = bookings.map(b => b.id);
          
          // Delete payments
          await tx.payment.deleteMany({
            where: { bookingId: { in: bookingIds } },
          });

          // Delete bookings
          await tx.booking.deleteMany({
            where: { id: { in: bookingIds } },
          });
        }

        // Finally delete the room
        await tx.room.delete({
          where: { id: roomId },
        });
      });

      return redirect("/dashboard/rooms");
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Force delete room error:", error);
    return json({ error: "Failed to delete room. Please try again." }, { status: 500 });
  }
}

export default function RoomDetails() {
  const { user, room, analytics } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigate = useNavigate();
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [confirmText, setConfirmText] = useState("");

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

  if (location.pathname !== `/dashboard/rooms/${room.id}`) return <Outlet />

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
            <Group>
              <Badge size="lg" color={getStatusColor(room.status)}>
                {room.status.replace("_", " ")}
              </Badge>
              {user?.role === "ADMIN" && (
                <Button
                  variant="filled"
                  color="red"
                  size="sm"
                  leftSection={<IconTrash size={16} />}
                  onClick={openDeleteModal}
                >
                  Force Delete
                </Button>
              )}
            </Group>
          </Group>

          <Grid gutter="md" >
            {/* Room Info Card */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" p="lg" h="100%">
                <Group justify="space-between" mb="md">
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconBed size={24} />
                  </ThemeIcon>
                  <Badge variant="light">{room.type.displayName}</Badge>
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
                  {analytics.topGuests.map((guest) => (
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
                  {room.bookings.slice(0, 5).map((booking) => (
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
                {room.assets.map((roomAsset) => (
                  <Card key={roomAsset.id} withBorder p="sm">
                    <Group justify="space-between" mb="xs">
                      <Text fw={500} size="sm">{roomAsset.asset.name}</Text>
                      <Badge
                        color={
                          roomAsset.condition === 'EXCELLENT' ? 'green' :
                            roomAsset.condition === 'GOOD' ? 'blue' :
                              roomAsset.condition === 'FAIR' ? 'yellow' :
                                roomAsset.condition === 'POOR' ? 'orange' :
                                  roomAsset.condition === 'DAMAGED' ? 'red' :
                                    roomAsset.condition === 'BROKEN' ? 'red' :
                                      'gray'
                        }
                        size="xs"
                      >
                        {roomAsset.condition}
                      </Badge>
                    </Group>

                    <Stack gap="xs">
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Category:</Text>
                        <Badge variant="light" size="xs">
                          {roomAsset.asset.category.replace('_', ' ')}
                        </Badge>
                      </Group>

                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Qty:</Text>
                        <Text size="xs">{roomAsset.quantity}</Text>
                      </Group>

                      {roomAsset.asset.serialNumber && (
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">Serial:</Text>
                          <Text size="xs" ff="monospace">{roomAsset.asset.serialNumber}</Text>
                        </Group>
                      )}

                      {roomAsset.asset.lastInspected && (
                        <Text size="xs" c="dimmed">
                          Inspected: {new Date(roomAsset.asset.lastInspected).toLocaleDateString()}
                        </Text>
                      )}

                      {roomAsset.notes && (
                        <Text size="xs" c="orange" style={{ fontStyle: 'italic' }}>
                          Room Note: {roomAsset.notes}
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

      {/* Force Delete Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Force Delete Room"
        size="md"
        centered
      >
        <Stack>
          {actionData?.error && (
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>
              {actionData.error}
            </Alert>
          )}
          
          <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
            <strong>Warning:</strong> This action cannot be undone. This will permanently delete:
            <Text component="ul" mt="xs" ml="md">
              <li>Room {room.number} and all its details</li>
              <li>All associated bookings and payments</li>
              <li>All maintenance logs</li>
              <li>All room assets</li>
            </Text>
          </Alert>

          <Form method="post" onSubmit={() => setConfirmText("")}>
            <input type="hidden" name="intent" value="force-delete" />
            <Stack>
              <Text size="sm" fw={500}>
                Type <strong>DELETE</strong> to confirm:
              </Text>
              <TextInput
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                name="confirm"
                placeholder="Type DELETE here"
                required
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="red"
                  disabled={confirmText !== "DELETE"}
                  leftSection={<IconTrash size={16} />}
                >
                  Delete Room
                </Button>
              </Group>
            </Stack>
          </Form>
        </Stack>
      </Modal>
    </DashboardLayout>
  );
}
