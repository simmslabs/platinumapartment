import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Title,
  Paper,
  Stack,
  Group,
  Badge,
  Text,
  Button,
  Card,
  Grid,
  Divider,
  Breadcrumbs,
  Anchor,
  Alert,
} from "@mantine/core";
import { IconArrowLeft, IconInfoCircle, IconCalendar, IconUser, IconHome, IconCreditCard } from "@tabler/icons-react";
import { format } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Booking Details - Apartment Management" },
    { name: "description", content: "View booking details" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const bookingId = params.bookingId;

  if (!bookingId) {
    throw new Response("Booking ID is required", { status: 400 });
  }

  // Get the booking with all related data
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      room: {
        select: {
          id: true,
          number: true,
          type: true,
          block: true,
          pricePerNight: true,
          pricingPeriod: true,
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          transactionId: true,
          createdAt: true,
        },
      },
      securityDeposit: {
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          transactionId: true,
          paidAt: true,
          refundedAt: true,
          refundAmount: true,
          deductionAmount: true,
          deductionReason: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  // Check if user has permission to view this booking
  if (user?.role === "GUEST" && booking.userId !== userId) {
    throw new Response("Unauthorized", { status: 403 });
  }

  return json({ booking, user });
}

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "yellow";
    case "CONFIRMED":
      return "blue";
    case "CHECKED_IN":
      return "green";
    case "CHECKED_OUT":
      return "gray";
    case "CANCELLED":
      return "red";
    default:
      return "gray";
  }
}

function getPaymentStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "yellow";
    case "COMPLETED":
      return "green";
    case "FAILED":
      return "red";
    case "REFUNDED":
      return "orange";
    default:
      return "gray";
  }
}

function getSecurityDepositStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "yellow";
    case "PAID":
      return "green";
    case "REFUNDED":
      return "blue";
    case "PARTIALLY_REFUNDED":
      return "orange";
    case "FORFEITED":
      return "red";
    default:
      return "gray";
  }
}

function getPricingPeriodDisplay(period: string) {
  switch (period) {
    case 'NIGHT': return 'night';
    case 'DAY': return 'day';
    case 'WEEK': return 'week';
    case 'MONTH': return 'month';
    case 'YEAR': return 'year';
    default: return 'night';
  }
}

export default function BookingDetail() {
  const { booking, user } = useLoaderData<typeof loader>();

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Bookings", href: "/dashboard/bookings" },
    { title: `Booking #${booking.id.slice(-8)}`, href: "#" },
  ].map((item, index) => (
    <Anchor 
      key={index} 
      href={item.href} 
      c={index === 2 ? "dimmed" : "blue"}
      onClick={(e) => {
        if (index === 2) e.preventDefault();
      }}
    >
      {item.title}
    </Anchor>
  ));

  const checkInDate = new Date(booking.checkIn);
  const checkOutDate = new Date(booking.checkOut);
  const stayDurationDays = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Breadcrumbs separator=">">{breadcrumbItems}</Breadcrumbs>
            <Title order={2} mt="xs">
              Booking Details
            </Title>
          </div>
          <Button
            component={Link}
            to="/dashboard/bookings"
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Bookings
          </Button>
        </Group>

        {booking.deletedAt && (
          <Alert variant="light" color="red" icon={<IconInfoCircle size={16} />}>
            This booking has been deleted on {format(new Date(booking.deletedAt), "MMM dd, yyyy 'at' h:mm a")}
          </Alert>
        )}

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              {/* Booking Information */}
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text size="lg" fw={600}>Booking Information</Text>
                    <Badge color={getStatusColor(booking.status)} size="lg">
                      {booking.status}
                    </Badge>
                  </Group>
                  
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Booking ID</Text>
                      <Text fw={500}>{booking.id}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Created</Text>
                      <Text fw={500}>{format(new Date(booking.createdAt), "MMM dd, yyyy 'at' h:mm a")}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Check-in Date</Text>
                      <Group gap="xs">
                        <IconCalendar size={16} />
                        <Text fw={500}>{format(checkInDate, "MMM dd, yyyy")}</Text>
                      </Group>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Check-out Date</Text>
                      <Group gap="xs">
                        <IconCalendar size={16} />
                        <Text fw={500}>{format(checkOutDate, "MMM dd, yyyy")}</Text>
                      </Group>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Duration</Text>
                      <Text fw={500}>{stayDurationDays} day{stayDurationDays !== 1 ? 's' : ''}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Total Amount</Text>
                      <Text fw={500} size="lg" c="green">GH₵ {booking.totalAmount.toFixed(2)}</Text>
                    </Grid.Col>
                  </Grid>

                  {booking.specialRequests && (
                    <>
                      <Divider />
                      <div>
                        <Text size="sm" c="dimmed" mb="xs">Special Requests</Text>
                        <Paper bg="gray.0" p="sm" radius="sm">
                          <Text size="sm">{booking.specialRequests}</Text>
                        </Paper>
                      </div>
                    </>
                  )}
                </Stack>
              </Card>

              {/* Guest Information */}
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text size="lg" fw={600}>Guest Information</Text>
                    <Button
                      component={Link}
                      to={`/dashboard/guests/${booking.user.id}`}
                      variant="light"
                      size="sm"
                      leftSection={<IconUser size={16} />}
                    >
                      View Profile
                    </Button>
                  </Group>
                  
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Name</Text>
                      <Text fw={500}>{booking.user.firstName} {booking.user.lastName}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Email</Text>
                      <Text fw={500}>{booking.user.email}</Text>
                    </Grid.Col>
                    {booking.user.phone && (
                      <Grid.Col span={6}>
                        <Text size="sm" c="dimmed">Phone</Text>
                        <Text fw={500}>{booking.user.phone}</Text>
                      </Grid.Col>
                    )}
                  </Grid>
                </Stack>
              </Card>

              {/* Room Information */}
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text size="lg" fw={600}>Room Information</Text>
                    <Button
                      component={Link}
                      to={`/dashboard/rooms/${booking.room.id}`}
                      variant="light"
                      size="sm"
                      leftSection={<IconHome size={16} />}
                    >
                      View Room
                    </Button>
                  </Group>
                  
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Room Number</Text>
                      <Text fw={500}>{booking.room.number}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Room Type</Text>
                      <Text fw={500}>{booking.room.type}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Block</Text>
                      <Text fw={500}>{booking.room.block}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Rate</Text>
                      <Text fw={500}>
                        GH₵ {booking.room.pricePerNight.toFixed(2)} per {getPricingPeriodDisplay(booking.room.pricingPeriod || 'NIGHT')}
                      </Text>
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Payment Information */}
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text size="lg" fw={600}>Payment</Text>
                    {booking.payment ? (
                      <Badge color={getPaymentStatusColor(booking.payment.status)} size="lg">
                        {booking.payment.status}
                      </Badge>
                    ) : (
                      <Badge color="red" size="lg">
                        UNPAID
                      </Badge>
                    )}
                  </Group>
                  
                  {booking.payment ? (
                    <Stack gap="sm">
                      <div>
                        <Text size="sm" c="dimmed">Amount</Text>
                        <Text fw={500} size="lg" c="green">GH₵ {booking.payment.amount.toFixed(2)}</Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">Payment Method</Text>
                        <Text fw={500}>{booking.payment.method}</Text>
                      </div>
                      {booking.payment.transactionId && (
                        <div>
                          <Text size="sm" c="dimmed">Transaction ID</Text>
                          <Text fw={500} size="xs" style={{ wordBreak: 'break-all' }}>
                            {booking.payment.transactionId}
                          </Text>
                        </div>
                      )}
                      <div>
                        <Text size="sm" c="dimmed">Payment Date</Text>
                        <Text fw={500}>{format(new Date(booking.payment.createdAt), "MMM dd, yyyy 'at' h:mm a")}</Text>
                      </div>
                    </Stack>
                  ) : (
                    <div>
                      <Text size="sm" c="dimmed" mb="md">No payment recorded</Text>
                      {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && booking.status === "PENDING" && (
                        <Stack gap="sm">
                          <Button
                            component={Link}
                            to={`/dashboard/payments/new?bookingId=${booking.id}&amount=${booking.totalAmount}&returnTo=/dashboard/bookings/${booking.id}`}
                            leftSection={<IconCreditCard size={16} />}
                            color="green"
                            size="md"
                            fullWidth
                          >
                            Receive Payment
                          </Button>
                          <Button
                            component={Link}
                            to={`/dashboard/payments?bookingId=${booking.id}`}
                            variant="light"
                            size="sm"
                            fullWidth
                          >
                            Record Payment
                          </Button>
                        </Stack>
                      )}
                    </div>
                  )}
                </Stack>
              </Card>

              {/* Security Deposit Information */}
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text size="lg" fw={600}>Security Deposit</Text>
                    {booking.securityDeposit ? (
                      <Badge color={getSecurityDepositStatusColor(booking.securityDeposit.status)} size="lg">
                        {booking.securityDeposit.status}
                      </Badge>
                    ) : (
                      <Badge color="gray" size="lg">
                        NOT REQUIRED
                      </Badge>
                    )}
                  </Group>
                  
                  {booking.securityDeposit ? (
                    <Stack gap="sm">
                      <div>
                        <Text size="sm" c="dimmed">Amount</Text>
                        <Text fw={500} size="lg" c="blue">GH₵ {booking.securityDeposit.amount.toFixed(2)}</Text>
                      </div>
                      {booking.securityDeposit.status === "PAID" && (
                        <>
                          <div>
                            <Text size="sm" c="dimmed">Payment Method</Text>
                            <Text fw={500}>{booking.securityDeposit.method}</Text>
                          </div>
                          {booking.securityDeposit.transactionId && (
                            <div>
                              <Text size="sm" c="dimmed">Transaction ID</Text>
                              <Text fw={500} size="xs" style={{ wordBreak: 'break-all' }}>
                                {booking.securityDeposit.transactionId}
                              </Text>
                            </div>
                          )}
                          <div>
                            <Text size="sm" c="dimmed">Paid Date</Text>
                            <Text fw={500}>{format(new Date(booking.securityDeposit.paidAt!), "MMM dd, yyyy 'at' h:mm a")}</Text>
                          </div>
                        </>
                      )}
                      {booking.securityDeposit.status === "REFUNDED" && booking.securityDeposit.refundedAt && (
                        <div>
                          <Text size="sm" c="dimmed">Refunded Date</Text>
                          <Text fw={500}>{format(new Date(booking.securityDeposit.refundedAt), "MMM dd, yyyy 'at' h:mm a")}</Text>
                        </div>
                      )}
                      {booking.securityDeposit.deductionAmount && booking.securityDeposit.deductionAmount > 0 && (
                        <>
                          <div>
                            <Text size="sm" c="dimmed">Deduction Amount</Text>
                            <Text fw={500} c="red">GH₵ {booking.securityDeposit.deductionAmount.toFixed(2)}</Text>
                          </div>
                          {booking.securityDeposit.deductionReason && (
                            <div>
                              <Text size="sm" c="dimmed">Deduction Reason</Text>
                              <Text fw={500}>{booking.securityDeposit.deductionReason}</Text>
                            </div>
                          )}
                        </>
                      )}
                    </Stack>
                  ) : (
                    <div>
                      <Text size="sm" c="dimmed" mb="md">No security deposit required for this booking</Text>
                      {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                        <Button
                          component={Link}
                          to={`/dashboard/security-deposits/new?bookingId=${booking.id}&returnTo=/dashboard/bookings/${booking.id}`}
                          leftSection={<IconCreditCard size={16} />}
                          color="blue"
                          variant="light"
                          size="sm"
                          fullWidth
                        >
                          Require Security Deposit
                        </Button>
                      )}
                    </div>
                  )}
                </Stack>
              </Card>

              {/* Quick Actions */}
              {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && !booking.deletedAt && (
                <Card withBorder>
                  <Stack gap="md">
                    <Text size="lg" fw={600}>Quick Actions</Text>
                    
                    {booking.status === "PENDING" && !booking.payment && (
                      <Button
                        component={Link}
                        to={`/dashboard/payments/new?bookingId=${booking.id}&amount=${booking.totalAmount}&returnTo=/dashboard/bookings/${booking.id}`}
                        leftSection={<IconCreditCard size={16} />}
                        color="green"
                        size="md"
                        fullWidth
                      >
                        Receive Payment
                      </Button>
                    )}
                    
                    {booking.securityDeposit && booking.securityDeposit.status === "PENDING" && (
                      <Button
                        component={Link}
                        to={`/dashboard/security-deposits/receive?bookingId=${booking.id}&depositId=${booking.securityDeposit.id}&amount=${booking.securityDeposit.amount}&returnTo=/dashboard/bookings/${booking.id}`}
                        leftSection={<IconCreditCard size={16} />}
                        color="blue"
                        size="md"
                        fullWidth
                      >
                        Receive Security Deposit
                      </Button>
                    )}
                    
                    <Button
                      component={Link}
                      to={`/dashboard/bookings?bookingId=${booking.id}`}
                      variant="light"
                      fullWidth
                    >
                      Edit Booking
                    </Button>
                    
                    {booking.status === "PENDING" && (
                      <Button
                        color="red"
                        variant="light"
                        fullWidth
                        onClick={() => {
                          if (confirm("Are you sure you want to cancel this booking?")) {
                            // Handle cancellation
                            window.location.href = `/dashboard/bookings?cancel=${booking.id}`;
                          }
                        }}
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </Stack>
                </Card>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </DashboardLayout>
  );
}
