import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useParams } from "@remix-run/react";
import {
  Title,
  Stack,
  Card,
  Text,
  Group,
  Badge,
  Grid,
  Table,
  Button,
  Paper,
  Divider,
  ThemeIcon,
  Progress,
  Timeline,
  Alert,
  NumberFormatter,
} from "@mantine/core";
import { format, differenceInDays, startOfYear, endOfYear } from "date-fns";
import {
  IconUser,
  IconCreditCard,
  IconCalendar,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconMapPin,
  IconPhone,
  IconMail,
  IconArrowLeft,
  IconWallet,
  IconReceipt,
  IconChartBar,
  IconInfoCircle,
} from "@tabler/icons-react";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Guest Details - Apartment Management" },
    { name: "description", content: "Detailed guest statistics and financial information" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const guestId = params.guestId;

  if (!guestId) {
    throw new Response("Guest ID is required", { status: 400 });
  }

  // Fetch guest with all related data
  const guest = await db.user.findUnique({
    where: { id: guestId, role: "GUEST" },
    include: {
      bookings: {
        include: {
          room: {
            include: {
              blockRelation: true,
            },
          },
          payment: true,
          securityDeposit: true,
          services: {
            include: {
              service: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!guest) {
    throw new Response("Guest not found", { status: 404 });
  }

  // Calculate financial statistics
  const currentYear = new Date().getFullYear();
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());

  const yearlyBookings = guest.bookings.filter(
    booking => new Date(booking.createdAt) >= yearStart && new Date(booking.createdAt) <= yearEnd
  );

  const totalRevenue = guest.bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const yearlyRevenue = yearlyBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  
  const totalPaid = guest.bookings.reduce((sum, booking) => {
    return sum + (booking.payment?.status === "COMPLETED" ? booking.payment.amount : 0);
  }, 0);

  const totalPending = guest.bookings.reduce((sum, booking) => {
    return sum + (booking.payment?.status === "PENDING" ? booking.totalAmount : 0);
  }, 0);

  const totalSecurityDeposits = guest.bookings.reduce((sum, booking) => {
    return sum + (booking.securityDeposit?.amount || 0);
  }, 0);

  const totalDepositsPaid = guest.bookings.reduce((sum, booking) => {
    return sum + (booking.securityDeposit?.status === "PAID" ? booking.securityDeposit.amount : 0);
  }, 0);

  const totalDepositsRefunded = guest.bookings.reduce((sum, booking) => {
    return sum + (booking.securityDeposit?.refundAmount || 0);
  }, 0);

  const totalNights = guest.bookings.reduce((sum, booking) => {
    return sum + differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
  }, 0);

  const averageStayDuration = guest.bookings.length > 0 ? totalNights / guest.bookings.length : 0;
  const averageSpending = guest.bookings.length > 0 ? totalRevenue / guest.bookings.length : 0;

  // Room type preferences
  const roomTypeStats = guest.bookings.reduce((acc, booking) => {
    const roomType = booking.room.type;
    acc[roomType] = (acc[roomType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Service usage
  const serviceStats = guest.bookings.flatMap(booking => booking.services).reduce((acc, service) => {
    const serviceName = service.service.name;
    acc[serviceName] = (acc[serviceName] || 0) + service.quantity;
    return acc;
  }, {} as Record<string, number>);

  // Calculate loyalty metrics
  const firstBooking = guest.bookings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  const customerSince = firstBooking ? format(new Date(firstBooking.createdAt), "MMMM yyyy") : "Never";
  const daysSinceFirstBooking = firstBooking ? differenceInDays(new Date(), new Date(firstBooking.createdAt)) : 0;

  return json({
    user,
    guest,
    stats: {
      totalBookings: guest.bookings.length,
      yearlyBookings: yearlyBookings.length,
      totalRevenue,
      yearlyRevenue,
      totalPaid,
      totalPending,
      totalSecurityDeposits,
      totalDepositsPaid,
      totalDepositsRefunded,
      totalNights,
      averageStayDuration,
      averageSpending,
      roomTypeStats,
      serviceStats,
      customerSince,
      daysSinceFirstBooking,
      currentYear,
    },
  });
}

export default function GuestDetails() {
  const { user, guest, stats } = useLoaderData<typeof loader>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
      case "COMPLETED":
      case "PAID":
        return "green";
      case "PENDING":
        return "yellow";
      case "CHECKED_IN":
        return "blue";
      case "CHECKED_OUT":
      case "REFUNDED":
        return "gray";
      case "CANCELLED":
      case "FAILED":
        return "red";
      default:
        return "gray";
    }
  };

  const getLoyaltyTier = () => {
    if (stats.totalBookings >= 20) return { tier: "Platinum", color: "violet" };
    if (stats.totalBookings >= 10) return { tier: "Gold", color: "yellow" };
    if (stats.totalBookings >= 5) return { tier: "Silver", color: "gray" };
    return { tier: "Bronze", color: "orange" };
  };

  const loyaltyTier = getLoyaltyTier();

  return (
    <Stack>
      {/* Header */}
      <Group>
        <Button
          component={Link}
          to="/dashboard/guests"
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
        >
          Back to Guests
        </Button>
        <Title order={2}>
          {guest.firstName} {guest.lastName} - Guest Details
        </Title>
        <Badge color={loyaltyTier.color} size="lg">
          {loyaltyTier.tier} Member
        </Badge>
      </Group>

        {/* Guest Information */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder h="100%">
              <Stack>
                <Group>
                  <ThemeIcon size="lg" variant="light">
                    <IconUser size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="lg">
                      {guest.firstName} {guest.lastName}
                    </Text>
                    <Text c="dimmed" size="sm">
                      Guest Profile
                    </Text>
                  </div>
                </Group>

                <Divider />

                <Stack gap="sm">
                  <Group gap="sm">
                    <IconMail size={16} />
                    <Text size="sm">{guest.email}</Text>
                  </Group>
                  {guest.phone && (
                    <Group gap="sm">
                      <IconPhone size={16} />
                      <Text size="sm">{guest.phone}</Text>
                    </Group>
                  )}
                  {guest.address && (
                    <Group gap="sm">
                      <IconMapPin size={16} />
                      <Text size="sm">{guest.address}</Text>
                    </Group>
                  )}
                  <Group gap="sm">
                    <IconClock size={16} />
                    <Text size="sm">
                      Customer since {stats.customerSince}
                    </Text>
                  </Group>
                  <Group gap="sm">
                    <IconCalendar size={16} />
                    <Text size="sm">
                      {stats.daysSinceFirstBooking} days as customer
                    </Text>
                  </Group>
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Financial Overview */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder>
              <Group mb="md">
                <ThemeIcon size="lg" variant="light" color="green">
                  <IconWallet size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="lg">
                    Financial Overview
                  </Text>
                  <Text c="dimmed" size="sm">
                    Revenue and payment statistics
                  </Text>
                </div>
              </Group>

              <Grid>
                <Grid.Col span={6}>
                  <Paper p="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="sm">
                          Total Revenue
                        </Text>
                        <Text fw={700} size="xl">
                          <NumberFormatter value={stats.totalRevenue} prefix="₵" thousandSeparator />
                        </Text>
                      </div>
                      <ThemeIcon color="green" variant="light">
                        <IconTrendingUp size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="sm">
                          {stats.currentYear} Revenue
                        </Text>
                        <Text fw={700} size="xl">
                          <NumberFormatter value={stats.yearlyRevenue} prefix="₵" thousandSeparator />
                        </Text>
                      </div>
                      <ThemeIcon color="blue" variant="light">
                        <IconChartBar size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="sm">
                          Payments Received
                        </Text>
                        <Text fw={700} size="xl" c="green">
                          <NumberFormatter value={stats.totalPaid} prefix="₵" thousandSeparator />
                        </Text>
                      </div>
                      <ThemeIcon color="green" variant="light">
                        <IconReceipt size={20} />
                      </ThemeIcon>
                    </Group>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Paper p="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="sm">
                          Pending Payments
                        </Text>
                        <Text fw={700} size="xl" c={stats.totalPending > 0 ? "red" : "green"}>
                          <NumberFormatter value={stats.totalPending} prefix="₵" thousandSeparator />
                        </Text>
                      </div>
                      <ThemeIcon color={stats.totalPending > 0 ? "red" : "green"} variant="light">
                        {stats.totalPending > 0 ? <IconTrendingDown size={20} /> : <IconTrendingUp size={20} />}
                      </ThemeIcon>
                    </Group>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Statistics Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Total Bookings</Text>
              <Text fw={700} size="xl">{stats.totalBookings}</Text>
              <Text c="dimmed" size="xs">{stats.yearlyBookings} this year</Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Total Nights</Text>
              <Text fw={700} size="xl">{stats.totalNights}</Text>
              <Text c="dimmed" size="xs">
                Avg: {stats.averageStayDuration.toFixed(1)} nights/stay
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Average Spending</Text>
              <Text fw={700} size="xl">
                <NumberFormatter value={stats.averageSpending} prefix="₵" decimalScale={0} />
              </Text>
              <Text c="dimmed" size="xs">per booking</Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Security Deposits</Text>
              <Text fw={700} size="xl">
                <NumberFormatter value={stats.totalDepositsPaid} prefix="₵" thousandSeparator />
              </Text>
              <Text c="dimmed" size="xs">
                Refunded: <NumberFormatter value={stats.totalDepositsRefunded} prefix="₵" />
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Room Preferences & Service Usage */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder>
              <Text fw={600} mb="md">Room Type Preferences</Text>
              {Object.keys(stats.roomTypeStats).length > 0 ? (
                <Stack gap="sm">
                  {Object.entries(stats.roomTypeStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([roomType, count]) => (
                      <Group key={roomType} justify="space-between">
                        <Text size="sm">{roomType.replace("_", " ")}</Text>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>{count}</Text>
                          <Progress
                            value={(count / stats.totalBookings) * 100}
                            size="sm"
                            w={100}
                          />
                        </Group>
                      </Group>
                    ))}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No room preferences data</Text>
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder>
              <Text fw={600} mb="md">Service Usage</Text>
              {Object.keys(stats.serviceStats).length > 0 ? (
                <Stack gap="sm">
                  {Object.entries(stats.serviceStats)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([serviceName, count]) => (
                      <Group key={serviceName} justify="space-between">
                        <Text size="sm">{serviceName}</Text>
                        <Badge variant="light">{count}x</Badge>
                      </Group>
                    ))}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">No service usage data</Text>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* Recent Bookings */}
        <Card withBorder>
          <Text fw={600} mb="md">Recent Bookings</Text>
          {guest.bookings.length > 0 ? (
            <Table.ScrollContainer minWidth={800}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Room</Table.Th>
                    <Table.Th>Dates</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Payment Status</Table.Th>
                    <Table.Th>Booking Status</Table.Th>
                    <Table.Th>Security Deposit</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {guest.bookings.slice(0, 10).map((booking) => (
                  <Table.Tr key={booking.id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>
                          {booking.room.blockRelation?.name || booking.room.block}-{booking.room.number}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {booking.room.type.replace("_", " ")}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm">
                          {format(new Date(booking.checkIn), "MMM dd")} - {format(new Date(booking.checkOut), "MMM dd, yyyy")}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn))} nights
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>
                        <NumberFormatter value={booking.totalAmount} prefix="₵" thousandSeparator />
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(booking.payment?.status || "PENDING")} size="sm">
                        {booking.payment?.status || "PENDING"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(booking.status)} size="sm">
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {booking.securityDeposit ? (
                        <div>
                          <Text size="sm">
                            <NumberFormatter value={booking.securityDeposit.amount} prefix="₵" />
                          </Text>
                          <Badge color={getStatusColor(booking.securityDeposit.status)} size="xs">
                            {booking.securityDeposit.status}
                          </Badge>
                        </div>
                      ) : (
                        <Text size="sm" c="dimmed">None</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            </Table.ScrollContainer>
          ) : (
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              This guest has no bookings yet.
            </Alert>
          )}
        </Card>

        {/* Reviews */}
        {guest.reviews.length > 0 && (
          <Card withBorder>
            <Text fw={600} mb="md">Guest Reviews</Text>
            <Timeline>
              {guest.reviews.slice(0, 5).map((review) => (
                <Timeline.Item key={review.id} title={review.title || "Review"}>
                  <Group mb="xs">
                    <Badge color="yellow" size="sm">
                      {review.rating}/5 stars
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {format(new Date(review.createdAt), "MMM dd, yyyy")}
                    </Text>
                  </Group>
                  {review.comment && (
                    <Text size="sm" c="dimmed">
                      {review.comment}
                    </Text>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        )}
      </Stack>
  );
}
