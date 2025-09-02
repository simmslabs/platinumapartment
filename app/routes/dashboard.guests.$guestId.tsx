import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useFetcher } from "@remix-run/react";
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
  Notification,
  Avatar,
  Box,
  Modal,
  NumberInput,
  Textarea,
  Checkbox,
  Select,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { format, differenceInDays, startOfYear, endOfYear, isAfter, addDays } from "date-fns";
import {
  IconUser,
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
  IconPlus,
  IconEdit,
  IconCheck,
  IconClockPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import DashboardLayout from "~/components/DashboardLayout";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Tenant Details - Apartment Management" },
    { name: "description", content: "Detailed guest statistics and financial information" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const guestId = params.guestId;

  if (!guestId) {
    throw new Response("Tenant ID is required", { status: 400 });
  }

  // Fetch guest with all related data
  const guest = await db.user.findUnique({
    where: { id: guestId, role: "TENANT" },
    include: {
      bookings: {
        include: {
          room: {
            include: {
              blockRelation: true,
              type: true,
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
    throw new Response("Tenant not found", { status: 404 });
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
    const roomWithType = booking.room as typeof booking.room & { type: { displayName: string } };
    const roomType = roomWithType.type?.displayName || 'Unknown';
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

  // Calculate overdue rent status
  const today = new Date();
  console.log("Today's date:", today);
  console.log("All bookings:", guest.bookings.map(b => ({
    id: b.id,
    status: b.status,
    checkOut: b.checkOut,
    paymentStatus: b.payment?.status || 'NO_PAYMENT',
    isAfterToday: isAfter(today, new Date(b.checkOut)),
    checkOutDate: new Date(b.checkOut)
  })));

  const overdueBookings = guest.bookings.filter(booking => {
    // Active booking statuses - expanded to include more possibilities
    const isActive = ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(booking.status);
    
    // Check if checkout date has passed
    const isOverdue = isAfter(today, new Date(booking.checkOut));
    
    // For overdue detection in apartment management:
    // If checkout date has passed and booking is still active, it's overdue regardless of payment status
    // This means tenant needs to either checkout or extend/rebook for additional period
    
    console.log(`Booking ${booking.id}:`, {
      isActive,
      isOverdue,
      status: booking.status,
      checkOut: booking.checkOut,
      paymentStatus: booking.payment?.status || 'NO_PAYMENT',
      daysPastDue: isOverdue ? differenceInDays(today, new Date(booking.checkOut)) : 0
    });
    
    return isActive && isOverdue;
  });

  const nearDueBookings = guest.bookings.filter(booking => {
    // Active booking statuses
    const isActive = ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(booking.status);
    
    const daysUntilDue = differenceInDays(new Date(booking.checkOut), today);
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;
    
    // Check payment status
    const hasUnpaidBalance = !booking.payment || 
                            booking.payment.status === "PENDING" || 
                            booking.payment.status === "FAILED" ||
                            booking.payment.status !== "COMPLETED";
    
    return isActive && isDueSoon && hasUnpaidBalance && !isAfter(today, new Date(booking.checkOut));
  });

  console.log("Overdue bookings found:", overdueBookings.length);
  console.log("Near due bookings found:", nearDueBookings.length);

  const activeBookings = guest.bookings.filter(booking => 
    ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(booking.status)
  );

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
      overdueBookings: overdueBookings.length,
      nearDueBookings: nearDueBookings.length,
      activeBookings: activeBookings.length,
      overdueBookingsList: overdueBookings,
      nearDueBookingsList: nearDueBookings,
    },
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "delete-booking") {
    const bookingId = formData.get("bookingId") as string;
    const forceDelete = formData.get("forceDelete") === "true";
    
    if (!bookingId) {
      return json({ error: "Booking ID is required" }, { status: 400 });
    }

    try {
      // First, get the booking details to check if it's overdue
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { 
          id: true, 
          status: true, 
          checkOut: true,
          room: { select: { number: true, block: true } }
        }
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 404 });
      }

      // Verify it's actually an overdue booking (unless force delete is enabled)
      if (!forceDelete) {
        const today = new Date();
        const isActive = ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(booking.status);
        const isOverdue = isAfter(today, new Date(booking.checkOut));

        if (!isActive || !isOverdue) {
          return json({ error: "Only overdue bookings can be deleted (or use force delete)" }, { status: 400 });
        }
      }

      // Delete the booking and related records
      await db.$transaction(async (prisma) => {
        // Delete related services first
        await prisma.bookingService.deleteMany({
          where: { bookingId: bookingId }
        });
        
        // Delete related payments
        await prisma.payment.deleteMany({
          where: { bookingId: bookingId }
        });
        
        // Delete related security deposits
        await prisma.securityDeposit.deleteMany({
          where: { bookingId: bookingId }
        });
        
        // Finally delete the booking
        await prisma.booking.delete({
          where: { id: bookingId }
        });
      });

      return json({ 
        success: true, 
        message: `${forceDelete ? 'Force deleted' : 'Overdue booking for'} Room ${booking.room.block}-${booking.room.number} has been deleted successfully.` 
      });
    } catch (error) {
      console.error("Error deleting booking:", error);
      return json({ error: "Failed to delete booking. Please try again." }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function GuestDetails() {
  const { user, guest, stats } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success");
  const fetcher = useFetcher<{success?: boolean; message?: string; error?: string}>();
  
  // Extension modal state
  const [extensionModalOpened, { open: openExtensionModal, close: closeExtensionModal }] = useDisclosure(false);
  const [selectedBooking, setSelectedBooking] = useState<typeof guest.bookings[0] | null>(null);
  const [extensionPeriods, setExtensionPeriods] = useState(1);
  const [extensionReason, setExtensionReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentAccount, setPaymentAccount] = useState("");

  // Delete confirmation modal state
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [bookingToDelete, setBookingToDelete] = useState<typeof guest.bookings[0] | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

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

  // Helper function to check if booking can be extended
  const canExtendBooking = (booking: typeof guest.bookings[0]) => {
    const today = new Date();
    const checkOutDate = new Date(booking.checkOut);
    const daysUntilCheckOut = differenceInDays(checkOutDate, today);
    
    // Can extend if booking is active (checked in, confirmed, or pending), and checkout is within 7 days or already passed
    return (
      ["CHECKED_IN", "CONFIRMED", "PENDING"].includes(booking.status) &&
      daysUntilCheckOut <= 7
    );
  };

  // Helper function to get period display name
  const getPeriodDisplayName = (period: string) => {
    switch (period) {
      case 'NIGHT': return 'night';
      case 'DAY': return 'day';
      case 'WEEK': return 'week';
      case 'MONTH': return 'month';
      case 'YEAR': return 'year';
      default: return 'day';
    }
  };

  // Handle extension submission
  const handleExtensionSubmit = () => {
    if (!selectedBooking) return;
    
    const formData = new FormData();
    formData.append("bookingId", selectedBooking.id);
    formData.append("extensionPeriods", extensionPeriods.toString());
    formData.append("reason", extensionReason);
    formData.append("paymentMethod", paymentMethod);
    formData.append("paymentAccount", paymentAccount);
    
    fetcher.submit(formData, {
      method: "POST",
      action: "/api/bookings/extend",
    });
    
    closeExtensionModal();
    setSelectedBooking(null);
    setExtensionPeriods(1);
    setExtensionReason("");
    setPaymentMethod("CASH");
    setPaymentAccount("");
  };

  // Handle delete confirmation submission
  const handleDeleteSubmit = () => {
    if (!bookingToDelete) return;
    
    const formData = new FormData();
    formData.append("bookingId", bookingToDelete.id);
    formData.append("action", "delete-booking");
    formData.append("forceDelete", forceDelete.toString());
    
    fetcher.submit(formData, {
      method: "POST",
      action: `/dashboard/guests/${guest.id}`,
    });
    
    closeDeleteModal();
    setBookingToDelete(null);
    setForceDelete(false);
  };

  return (
    <DashboardLayout user={user}>
      <Stack>
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Button
              component={Link}
              to="/dashboard/guests"
              leftSection={<IconArrowLeft size={16} />}
              variant="subtle"
            >
              Back to Tenants
            </Button>
            <Title order={2}>
              {guest.firstName} {guest.lastName} - Tenant Details
            </Title>
            <Badge color={loyaltyTier.color} size="lg">
              {loyaltyTier.tier} Member
            </Badge>
          </Group>
          <Group gap="sm">
            <Button
              component={Link}
              to={`/dashboard/guests/new?guestId=${guest.id}`}
              leftSection={<IconEdit size={16} />}
              variant="light"
            >
              Edit Tenant
            </Button>
            <Button
              component={Link}
              to={`/dashboard/bookings/new?guestId=${guest.id}`}
              leftSection={<IconPlus size={16} />}
              variant="filled"
            >
              Add Booking
            </Button>
          </Group>
        </Group>

        {success === "guest-updated" && (
          <Notification
            icon={<IconCheck size={18} />}
            color="green"
            title="Success"
            onClose={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("success");
              window.history.replaceState({}, "", url);
            }}
          >
            Tenant information has been updated successfully.
          </Notification>
        )}

        {fetcher.data?.success && (
          <Notification
            icon={<IconCheck size={18} />}
            color="green"
            title={fetcher.data.message?.includes("deleted") ? "Booking Deleted Successfully" : "Rent Extended Successfully"}
            onClose={() => window.location.reload()}
          >
            {fetcher.data.message}
          </Notification>
        )}

        {fetcher.data?.error && (
          <Notification
            icon={<IconInfoCircle size={18} />}
            color="red"
            title={fetcher.data.error?.includes("delete") ? "Deletion Failed" : "Extension Failed"}
            onClose={() => window.location.reload()}
          >
            {fetcher.data.error}
          </Notification>
        )}

        {/* OVERDUE RENT STATUS - Prominent Alert */}
        {stats.overdueBookings > 0 && (
          <Alert
            icon={<IconClock size={20} />}
            title="⚠️ RENT OVERDUE"
            color="red"
            variant="filled"
            style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              border: '3px solid #fa5252',
              boxShadow: '0 4px 12px rgba(250, 82, 82, 0.3)'
            }}
          >
            <Stack gap="xs">
              <Text size="lg" fw={700} c="white">
                {stats.overdueBookings} ACTIVE BOOKING{stats.overdueBookings > 1 ? 'S' : ''} OVERDUE
              </Text>
              {stats.overdueBookingsList.map((booking: typeof guest.bookings[0]) => (
                <Group key={booking.id} justify="space-between" style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px' }}>
                  <div>
                    <Text c="white" fw={600}>
                      Room {booking.room.block}-{booking.room.number}
                    </Text>
                    <Text c="white" fw={600}>
                      Due: {format(new Date(booking.checkOut), "MMM dd, yyyy")} 
                      ({differenceInDays(new Date(), new Date(booking.checkOut))} days overdue)
                    </Text>
                    <Text c="white" fw={700}>
                      Amount: <NumberFormatter value={booking.totalAmount} prefix="₵" thousandSeparator />
                    </Text>
                    <Text c="white" fw={500} size="sm">
                      Payment: {booking.payment?.status || 'NO_PAYMENT'}
                      {booking.payment?.status === 'COMPLETED' && ' - Needs Extension/Rebook'}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="white"
                      color="red"
                      leftSection={<IconRefresh size={14} />}
                      component={Link}
                      to={`/dashboard/bookings/new?guestId=${guest.id}&rebookFromId=${booking.id}`}
                    >
                      Rebook
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="white"
                      leftSection={<IconClockPlus size={14} />}
                      onClick={() => {
                        setSelectedBooking(booking);
                        openExtensionModal();
                      }}
                    >
                      Extend
                    </Button>
                    <Button
                      size="xs"
                      variant="filled"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => {
                        setBookingToDelete(booking);
                        openDeleteModal();
                      }}
                    >
                      Delete
                    </Button>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Alert>
        )}

        {/* NEAR DUE RENT STATUS */}
        {stats.nearDueBookings > 0 && stats.overdueBookings === 0 && (
          <Alert
            icon={<IconClock size={20} />}
            title="⏰ RENT DUE SOON"
            color="orange"
            variant="filled"
            style={{ 
              fontSize: '14px', 
              fontWeight: 'bold',
              border: '2px solid #fd7e14'
            }}
          >
            <Stack gap="xs">
              <Text size="md" fw={600} c="white">
                {stats.nearDueBookings} BOOKING{stats.nearDueBookings > 1 ? 'S' : ''} DUE WITHIN 7 DAYS
              </Text>
              {stats.nearDueBookingsList.map((booking: typeof guest.bookings[0]) => (
                <Group key={booking.id} justify="space-between" style={{ background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '4px' }}>
                  <div>
                    <Text c="white" fw={500}>
                      Room {booking.room.block}-{booking.room.number}
                    </Text>
                    <Text c="white" fw={500}>
                      Due: {format(new Date(booking.checkOut), "MMM dd, yyyy")}
                      ({differenceInDays(new Date(booking.checkOut), new Date())} days remaining)
                    </Text>
                    <Text c="white" fw={600}>
                      <NumberFormatter value={booking.totalAmount} prefix="₵" thousandSeparator />
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="white"
                      color="orange"
                      leftSection={<IconRefresh size={14} />}
                      component={Link}
                      to={`/dashboard/bookings/new?guestId=${guest.id}&rebookFromId=${booking.id}`}
                    >
                      Rebook
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="white"
                      leftSection={<IconClockPlus size={14} />}
                      onClick={() => {
                        setSelectedBooking(booking);
                        openExtensionModal();
                      }}
                    >
                      Extend
                    </Button>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Alert>
        )}

        {/* Tenant Information */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder h="100%">
              <Stack>
                <Group>
                  {guest.profilePicture ? (
                    <Avatar 
                      src={guest.profilePicture} 
                      size="lg" 
                      radius="md"
                      alt={`${guest.firstName} ${guest.lastName}`}
                    />
                  ) : (
                    <ThemeIcon size="lg" variant="light">
                      <IconUser size={20} />
                    </ThemeIcon>
                  )}
                  <div>
                    <Text fw={600} size="lg">
                      {guest.firstName} {guest.lastName}
                    </Text>
                    <Text c="dimmed" size="sm">
                      Tenant Profile
                    </Text>
                  </div>
                </Group>

                {/* Profile Picture Preview Section */}
                {guest.profilePicture && (
                  <Box>
                    <Text size="sm" fw={500} mb="xs">Profile Picture</Text>
                    <Avatar
                      src={guest.profilePicture}
                      size={120}
                      radius="md"
                      mx="auto"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        // Open full size image in new window
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head>
                                <title>${guest.firstName} ${guest.lastName} - Profile Picture</title>
                                <style>
                                  body { 
                                    margin: 0; 
                                    padding: 20px; 
                                    background: #f5f5f5; 
                                    display: flex; 
                                    justify-content: center; 
                                    align-items: center; 
                                    min-height: 100vh;
                                    font-family: Arial, sans-serif;
                                  }
                                  img { 
                                    max-width: 90vw; 
                                    max-height: 90vh; 
                                    border-radius: 8px; 
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                  }
                                  .caption {
                                    position: absolute;
                                    bottom: 20px;
                                    left: 50%;
                                    transform: translateX(-50%);
                                    background: rgba(0,0,0,0.7);
                                    color: white;
                                    padding: 8px 16px;
                                    border-radius: 4px;
                                    font-size: 14px;
                                  }
                                </style>
                              </head>
                              <body>
                                <img src="${guest.profilePicture}" alt="${guest.firstName} ${guest.lastName} Profile Picture" />
                                <div class="caption">${guest.firstName} ${guest.lastName}</div>
                              </body>
                            </html>
                          `);
                          newWindow.document.close();
                        }
                      }}
                    />
                    <Text size="xs" c="dimmed" ta="center" mt="xs">
                      Click to view full size
                    </Text>
                  </Box>
                )}

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
          {/* Overdue Status Card - Most Prominent */}
          {stats.overdueBookings > 0 && (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder style={{ 
                borderColor: '#f44336', 
                borderWidth: '3px',
                background: 'linear-gradient(45deg, #ffebee, #ffcdd2)',
                boxShadow: '0 4px 12px rgba(244, 67, 54, 0.2)'
              }}>
                <Group justify="space-between" mb="xs">
                  <Text c="red" size="sm" fw={700}>🚨 OVERDUE RENT</Text>
                  <ThemeIcon color="red" variant="filled" size="lg">
                    <IconClock size={20} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl" c="red">{stats.overdueBookings}</Text>
                <Text c="red" size="xs" fw={600} mb="sm">
                  Active booking{stats.overdueBookings > 1 ? 's' : ''} overdue
                </Text>
                <Button
                  size="xs"
                  variant="filled"
                  color="red"
                  fullWidth
                  leftSection={<IconRefresh size={14} />}
                  component={Link}
                  to={`/dashboard/bookings/new?guestId=${guest.id}`}
                >
                  Create New Booking
                </Button>
              </Card>
            </Grid.Col>
          )}

          {/* Near Due Status Card */}
          {stats.nearDueBookings > 0 && (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder style={{ 
                borderColor: '#ff9800', 
                borderWidth: '2px',
                background: 'linear-gradient(45deg, #fff3e0, #ffe0b2)'
              }}>
                <Group justify="space-between" mb="xs">
                  <Text c="orange" size="sm" fw={600}>⏰ DUE SOON</Text>
                  <ThemeIcon color="orange" variant="filled">
                    <IconCalendar size={16} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="xl" c="orange">{stats.nearDueBookings}</Text>
                <Text c="orange" size="xs" fw={500}>
                  Due within 7 days
                </Text>
              </Card>
            </Grid.Col>
          )}

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
          <Group justify="space-between" mb="md">
            <Text fw={600}>Recent Bookings</Text>
            <Text size="sm" c="dimmed">
              Rent can be extended for active bookings within 7 days of checkout
            </Text>
          </Group>
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
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {guest.bookings.slice(0, 10).map((booking) => {
                    const today = new Date();
                    const isOverdue = isAfter(today, new Date(booking.checkOut)) && 
                                     ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(booking.status);
                    
                    const isDueSoon = differenceInDays(new Date(booking.checkOut), today) >= 0 && 
                                     differenceInDays(new Date(booking.checkOut), today) <= 7 &&
                                     ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(booking.status) &&
                                     (!booking.payment || 
                                      booking.payment.status === "PENDING" || 
                                      booking.payment.status === "FAILED" ||
                                      booking.payment.status !== "COMPLETED") &&
                                     !isAfter(today, new Date(booking.checkOut));
                    
                    return (
                      <Table.Tr key={booking.id} style={{ 
                        backgroundColor: isOverdue ? '#ffebee' : isDueSoon ? '#fff3e0' : 'transparent',
                        borderLeft: isOverdue ? '4px solid #f44336' : isDueSoon ? '4px solid #ff9800' : 'none'
                      }}>
                      <Table.Td>
                        <div>
                          <Group gap="xs">
                            <Text size="sm" fw={500}>
                              {booking.room.blockRelation?.name || booking.room.block}-{booking.room.number}
                            </Text>
                            {isOverdue && (
                              <Badge color="red" size="xs" variant="filled" style={{ fontWeight: 'bold' }}>
                                OVERDUE
                              </Badge>
                            )}
                            {isDueSoon && !isOverdue && (
                              <Badge color="orange" size="xs" variant="filled">
                                DUE SOON
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {((booking.room as typeof booking.room & { type: { displayName: string } }).type?.displayName || 'Unknown Type')}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <div>
                          <Group gap="xs">
                            <Text size="sm">
                              {format(new Date(booking.checkIn), "MMM dd")} - {format(new Date(booking.checkOut), "MMM dd, yyyy")}
                            </Text>
                            {isOverdue && (
                              <Text size="xs" c="red" fw={700}>
                                ({differenceInDays(today, new Date(booking.checkOut))} days overdue)
                              </Text>
                            )}
                            {isDueSoon && !isOverdue && (
                              <Text size="xs" c="orange" fw={600}>
                                ({differenceInDays(new Date(booking.checkOut), today)} days left)
                              </Text>
                            )}
                          </Group>
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
                      <Table.Td>
                        <Group gap="xs">
                          {canExtendBooking(booking) && (
                            <Button
                              size="xs"
                              variant="light"
                              color="blue"
                              leftSection={<IconClockPlus size={14} />}
                              onClick={() => {
                                setSelectedBooking(booking);
                                openExtensionModal();
                              }}
                            >
                              Extend
                            </Button>
                          )}
                          {isOverdue && (
                            <Button
                              size="xs"
                              variant="filled"
                              color="red"
                              leftSection={<IconRefresh size={14} />}
                              component={Link}
                              to={`/dashboard/bookings/new?guestId=${guest.id}&rebookFromId=${booking.id}`}
                            >
                              Rebook
                            </Button>
                          )}
                          {isDueSoon && !isOverdue && (
                            <Button
                              size="xs"
                              variant="light"
                              color="orange"
                              leftSection={<IconRefresh size={14} />}
                              component={Link}
                              to={`/dashboard/bookings/new?guestId=${guest.id}&rebookFromId=${booking.id}`}
                            >
                              Rebook
                            </Button>
                          )}
                          {!canExtendBooking(booking) && !isOverdue && !isDueSoon && (
                            <Text size="xs" c="dimmed">
                              {["CHECKED_OUT", "CANCELLED"].includes(booking.status) 
                                ? "Completed" 
                                : "Not eligible"}
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    );
                  })}
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
            <Text fw={600} mb="md">Tenant Reviews</Text>
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
        
        {/* Delete Confirmation Modal */}
        <Modal
          opened={deleteModalOpened}
          onClose={closeDeleteModal}
          title="Delete Booking Confirmation"
          size="md"
        >
          {bookingToDelete && (
            <Stack gap="md">
              <Alert color="red" variant="light">
                <Text size="sm">
                  <strong>⚠️ Warning:</strong> You are about to delete the booking for:
                </Text>
                <Text size="sm" mt="xs">
                  <strong>Room:</strong> {bookingToDelete.room.block}-{bookingToDelete.room.number}
                </Text>
                <Text size="sm">
                  <strong>Tenant:</strong> {guest.firstName} {guest.lastName}
                </Text>
                <Text size="sm">
                  <strong>Period:</strong> {format(new Date(bookingToDelete.checkIn), "MMM dd")} - {format(new Date(bookingToDelete.checkOut), "MMM dd, yyyy")}
                </Text>
                <Text size="sm">
                  <strong>Amount:</strong> <NumberFormatter value={bookingToDelete.totalAmount} prefix="₵" thousandSeparator />
                </Text>
                <Text size="sm">
                  <strong>Status:</strong> {bookingToDelete.status}
                </Text>
              </Alert>

              <Text size="sm" c="dimmed">
                This action will permanently delete the booking and all related data including payments, security deposits, and services. This cannot be undone.
              </Text>

              <Checkbox
                checked={forceDelete}
                onChange={(event) => setForceDelete(event.currentTarget.checked)}
                label="Force delete (bypass overdue validation)"
                description="Check this to delete any booking regardless of its status or due date"
                color="red"
              />
              
              <Group justify="flex-end" gap="sm">
                <Button variant="light" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteSubmit}
                  loading={fetcher.state === "submitting"}
                  leftSection={<IconTrash size={16} />}
                  color="red"
                  variant="filled"
                >
                  {forceDelete ? "Force Delete" : "Delete Booking"}
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
        
        {/* Rent Extension Modal */}
        <Modal
          opened={extensionModalOpened}
          onClose={closeExtensionModal}
          title="Extend Rent Period"
          size="md"
        >
          {selectedBooking && (
            <Stack gap="md">
              <Alert color="blue" variant="light">
                <Text size="sm">
                  <strong>Room:</strong> {selectedBooking.room.blockRelation?.name || selectedBooking.room.block}-{selectedBooking.room.number}
                </Text>
                <Text size="sm">
                  <strong>Current checkout:</strong> {format(new Date(selectedBooking.checkOut), "MMM dd, yyyy")}
                </Text>
                <Text size="sm">
                  <strong>Rate:</strong> ₵{selectedBooking.room.pricePerNight}/{getPeriodDisplayName(selectedBooking.room.pricingPeriod || 'NIGHT')}
                </Text>
              </Alert>
              
              <NumberInput
                label={`Extension periods (${getPeriodDisplayName(selectedBooking.room.pricingPeriod || 'NIGHT')}s)`}
                description={`How many ${getPeriodDisplayName(selectedBooking.room.pricingPeriod || 'NIGHT')}s to extend the rent?`}
                value={extensionPeriods}
                onChange={(value) => setExtensionPeriods(typeof value === 'number' ? value : 1)}
                min={1}
                max={12}
                required
              />
              
              {extensionPeriods > 0 && selectedBooking.room.pricePerNight && (
                <Paper p="sm" withBorder bg="blue.0">
                  <Group justify="space-between">
                    <Text size="sm">Additional cost:</Text>
                    <Text size="sm" fw={500}>
                      ₵{(selectedBooking.room.pricePerNight * extensionPeriods).toFixed(2)}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">New checkout date:</Text>
                    <Text size="sm" fw={500}>
                      {(() => {
                        const currentCheckOut = new Date(selectedBooking.checkOut);
                        let newDate: Date;
                        switch (selectedBooking.room.pricingPeriod) {
                          case 'WEEK':
                            newDate = addDays(currentCheckOut, extensionPeriods * 7);
                            break;
                          case 'MONTH':
                            newDate = new Date(currentCheckOut);
                            newDate.setMonth(newDate.getMonth() + extensionPeriods);
                            break;
                          case 'YEAR':
                            newDate = new Date(currentCheckOut);
                            newDate.setFullYear(newDate.getFullYear() + extensionPeriods);
                            break;
                          default:
                            newDate = addDays(currentCheckOut, extensionPeriods);
                        }
                        return format(newDate, "MMM dd, yyyy");
                      })()}
                    </Text>
                  </Group>
                </Paper>
              )}
              
              <Textarea
                label="Reason for extension (optional)"
                placeholder="Enter reason for extending the rent period..."
                value={extensionReason}
                onChange={(event) => setExtensionReason(event.currentTarget.value)}
                rows={3}
              />

              {/* Payment Information Section */}
              <Divider label="Payment Information" labelPosition="center" />
              
              <Select
                label="Payment Method"
                placeholder="Select payment method"
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value || "CASH")}
                data={[
                  { value: "CASH", label: "Cash" },
                  { value: "BANK_TRANSFER", label: "Bank Transfer" },
                  { value: "MOBILE_MONEY", label: "Mobile Money" },
                  { value: "CREDIT_CARD", label: "Credit Card" },
                  { value: "DEBIT_CARD", label: "Debit Card" },
                  { value: "ONLINE", label: "Online Payment" },
                  { value: "PAYPAL", label: "PayPal" },
                  { value: "STRIPE", label: "Stripe" },
                ]}
                required
              />

              {paymentMethod !== "CASH" && (
                <Textarea
                  label={`${paymentMethod === "BANK_TRANSFER" ? "Bank Account Details" : 
                          paymentMethod === "MOBILE_MONEY" ? "Mobile Money Account" :
                          paymentMethod === "CREDIT_CARD" || paymentMethod === "DEBIT_CARD" ? "Card Details" :
                          paymentMethod === "PAYPAL" ? "PayPal Account" :
                          paymentMethod === "STRIPE" ? "Stripe Details" :
                          "Account Details"}`}
                  placeholder={`Enter ${paymentMethod === "BANK_TRANSFER" ? "bank account number and name" : 
                               paymentMethod === "MOBILE_MONEY" ? "mobile money number" :
                               paymentMethod === "CREDIT_CARD" || paymentMethod === "DEBIT_CARD" ? "last 4 digits of card" :
                               paymentMethod === "PAYPAL" ? "PayPal email address" :
                               paymentMethod === "STRIPE" ? "Stripe payment ID" :
                               "account information"}...`}
                  value={paymentAccount}
                  onChange={(event) => setPaymentAccount(event.currentTarget.value)}
                  rows={2}
                />
              )}

              {extensionPeriods > 0 && selectedBooking.room.pricePerNight && (
                <Alert color="blue" variant="light">
                  <Text size="sm" fw={500}>
                    💰 Payment Required: <NumberFormatter value={selectedBooking.room.pricePerNight * extensionPeriods} prefix="₵" />
                  </Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    This amount will be recorded as a transaction and added to the tenant&apos;s payment history.
                  </Text>
                </Alert>
              )}
              
              <Group justify="flex-end" gap="sm">
                <Button variant="light" onClick={closeExtensionModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleExtensionSubmit}
                  loading={fetcher.state === "submitting"}
                  leftSection={<IconClockPlus size={16} />}
                >
                  Extend Rent
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
