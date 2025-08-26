import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, Outlet, useLocation } from "@remix-run/react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Select,
  Alert,
  Text,
  Card,
  TextInput,
  ActionIcon,
  Menu,
} from "@mantine/core";
import { IconPlus, IconInfoCircle, IconTrash, IconSearch, IconDots, IconEye } from "@tabler/icons-react";
import { format } from "date-fns";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Booking, BookingStatus, RoomStatus } from "@prisma/client";
import { emailService } from "~/utils/email.server";
import { mnotifyService } from "~/utils/mnotify.server";
import { useState, useMemo } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Bookings - Apartment Management" },
    { name: "description", content: "Manage apartment bookings" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const url = new URL(request.url);
  const showDeleted = url.searchParams.get("showDeleted") === "true";
  const paymentStatus = url.searchParams.get("paymentStatus") || "all";

  // Filter bookings based on user role and soft deletion
  const bookingFilter = {
    ...(user?.role === "GUEST" ? { userId: userId } : {}), // Guests only see their own bookings
    ...(showDeleted ? {} : { deletedAt: null }), // Exclude soft-deleted bookings by default
  };

  const bookings = await db.booking.findMany({
    where: bookingFilter,
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      room: {
        select: { number: true, type: true, block: true, pricingPeriod: true, pricePerNight: true },
      },
      payment: {
        select: { 
          id: true, 
          amount: true, 
          status: true, 
          method: true, 
          paidAt: true,
          transactionId: true 
        }
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter bookings based on payment status
  const filteredBookings = bookings.filter(booking => {
    if (paymentStatus === "paid") {
      return booking.payment && booking.payment.status === "COMPLETED";
    } else if (paymentStatus === "unpaid") {
      return !booking.payment || booking.payment.status !== "COMPLETED";
    }
    return true; // Show all if paymentStatus is "all"
  });

  const availableRooms = await db.room.findMany({
    where: { status: "AVAILABLE" },
    select: { id: true, number: true, type: true, pricePerNight: true, pricingPeriod: true, block: true },
  });

  const guests = await db.user.findMany({
    where: { role: "GUEST" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });

  return json({ user, bookings: filteredBookings, availableRooms, guests, showDeleted, paymentStatus });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const userId = formData.get("userId") as string;
      const roomId = formData.get("roomId") as string;
      const checkInStr = formData.get("checkIn") as string;
      const guests = parseInt(formData.get("guests") as string);
      const specialRequests = formData.get("specialRequests") as string;
      const numberOfPeriods = parseInt(formData.get("numberOfPeriods") as string) || 1;

      console.log("Form data received:", { 
        userId, 
        roomId, 
        checkInStr, 
        guests, 
        numberOfPeriods,
        allFormData: Object.fromEntries(formData.entries())
      });

      if (!userId) {
        return json({ error: "Please select a guest" }, { status: 400 });
      }
      if (!roomId) {
        return json({ error: "Please select a room" }, { status: 400 });
      }
      if (!checkInStr) {
        return json({ error: "Please select a check-in date" }, { status: 400 });
      }
      if (!guests || isNaN(guests)) {
        return json({ error: "Please enter the number of guests" }, { status: 400 });
      }

      // Parse dates
      const checkIn = new Date(checkInStr);

      // Validate dates
      if (isNaN(checkIn.getTime())) {
        return json({ error: "Invalid check-in date" }, { status: 400 });
      }

      // Set standard check-in time (3:00 PM)
      checkIn.setHours(15, 0, 0, 0);

      // Get room details for calculation
      const room = await db.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return json({ error: "Room not found" }, { status: 400 });
      }

      // Always use periods calculation
      const totalAmount = numberOfPeriods * room.pricePerNight;

      // Calculate checkout date based on periods with proper time consideration
      const finalCheckOut = new Date(checkIn);
      switch (room.pricingPeriod) {
        case 'NIGHT':
          // For nightly stays, checkout is next day at 11:00 AM
          finalCheckOut.setDate(finalCheckOut.getDate() + numberOfPeriods);
          finalCheckOut.setHours(11, 0, 0, 0);
          break;
        case 'DAY':
          // For daily stays, checkout is same number of days later at 11:00 AM
          finalCheckOut.setDate(finalCheckOut.getDate() + numberOfPeriods);
          finalCheckOut.setHours(11, 0, 0, 0);
          break;
        case 'WEEK':
          finalCheckOut.setDate(finalCheckOut.getDate() + (numberOfPeriods * 7));
          finalCheckOut.setHours(11, 0, 0, 0);
          break;
        case 'MONTH':
          finalCheckOut.setMonth(finalCheckOut.getMonth() + numberOfPeriods);
          finalCheckOut.setHours(11, 0, 0, 0);
          break;
        case 'YEAR':
          finalCheckOut.setFullYear(finalCheckOut.getFullYear() + numberOfPeriods);
          finalCheckOut.setHours(11, 0, 0, 0);
          break;
        default:
          finalCheckOut.setDate(finalCheckOut.getDate() + numberOfPeriods);
          finalCheckOut.setHours(11, 0, 0, 0);
      }

      // Get user details for email
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return json({ error: "User not found" }, { status: 400 });
      }

      console.log("Creating booking with:", { userId, roomId, checkIn, finalCheckOut, guests, totalAmount });

      const newBooking = await db.booking.create({
        data: {
          userId,
          roomId,
          checkIn,
          checkOut: finalCheckOut,
          guests,
          totalAmount,
          specialRequests: specialRequests || null,
          status: "PENDING", // Start as PENDING until payment is made
        },
      });

      console.log("Booking created successfully:", newBooking.id);

      // Send booking confirmation email (don't block the response if email fails)
      try {
        await emailService.sendBookingConfirmation({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roomNumber: (await db.room.findUnique({ where: { id: roomId } }))?.number || '',
          checkIn: checkIn.toLocaleDateString(),
          checkOut: finalCheckOut.toLocaleDateString(),
          totalAmount,
          bookingId: newBooking.id,
        });
        console.log(`Booking confirmation email sent to ${user.email}`);
      } catch (emailError) {
        console.error(`Failed to send booking confirmation to ${user.email}:`, emailError);
        // Don't fail the booking if email fails
      }

      return json({ 
        success: "Booking created successfully! Don't forget to collect the ₵200 security deposit.",
        bookingId: newBooking.id 
      });
    }

    if (intent === "update-status") {
      const bookingId = formData.get("bookingId") as string;
      const status = formData.get("status") as string;

      // Get booking with user and room details before updating
      const bookingWithDetails = await db.booking.findUnique({
        where: { id: bookingId },
        include: { 
          room: true,
          user: true 
        },
      });

      if (!bookingWithDetails) {
        return json({ error: "Booking not found" }, { status: 404 });
      }

      await db.booking.update({
        where: { id: bookingId },
        data: { status: status as BookingStatus },
      });

      // Update room status based on booking status
      if (bookingWithDetails) {
        let roomStatus = "AVAILABLE";
        if (status === "CHECKED_IN") {
          roomStatus = "OCCUPIED";
        }
        
        await db.room.update({
          where: { id: bookingWithDetails.roomId },
          data: { status: roomStatus as RoomStatus },
        });
      }

      // Send SMS notifications when booking is confirmed
      // This feature requires:
      // 1. MNOTIFY_API_KEY environment variable
      // 2. MNOTIFY_SENDER_ID environment variable  
      // 3. ADMIN_PHONE_NUMBER environment variable for admin alerts
      // 4. Guest must have a valid phone number in their profile
      if (status === "CONFIRMED") {
        try {
          const guestName = `${bookingWithDetails.user.firstName} ${bookingWithDetails.user.lastName}`;
          const roomNumber = bookingWithDetails.room.number;
          const checkIn = format(new Date(bookingWithDetails.checkIn), "MMM dd, yyyy");
          const checkOut = format(new Date(bookingWithDetails.checkOut), "MMM dd, yyyy");

          // Send SMS to guest (if phone number exists)
          if (bookingWithDetails.user.phone) {
            await mnotifyService.sendBookingConfirmation(
              bookingWithDetails.user.phone,
              guestName,
              roomNumber,
              checkIn,
              checkOut
            );
            console.log(`Booking confirmation SMS sent to guest: ${bookingWithDetails.user.phone}`);
          }

          // Send SMS alert to admin/manager
          const adminPhone = process.env.ADMIN_PHONE_NUMBER;
          if (adminPhone) {
            await mnotifyService.sendStaffAlert(
              adminPhone,
              "Admin",
              "Booking Confirmed",
              `Booking #${bookingId.slice(-6)} confirmed for ${guestName} in Room ${roomNumber} (${checkIn} - ${checkOut})`
            );
            console.log(`Booking confirmation alert sent to admin: ${adminPhone}`);
          }

        } catch (smsError) {
          console.error("Failed to send SMS notifications:", smsError);
          // Don't fail the entire request if SMS fails
        }
      }

      return json({ success: "Booking status updated successfully" });
    }

    if (intent === "delete") {
      const bookingId = formData.get("bookingId") as string;

      // Get booking details before soft deletion
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }

      // Check if booking is already soft deleted
      if (booking.deletedAt) {
        return json({ error: "Booking is already deleted" }, { status: 400 });
      }

      // Only allow soft deletion of PENDING or CANCELLED bookings
      if (!["PENDING", "CANCELLED"].includes(booking.status)) {
        return json({ error: "Only pending or cancelled bookings can be deleted" }, { status: 400 });
      }

      // Perform soft deletion by setting deletedAt timestamp
      await db.booking.update({
        where: { id: bookingId },
        data: { 
          deletedAt: new Date(),
          status: "CANCELLED" // Set status to cancelled when soft deleted
        },
      });

      // If room was occupied, set it back to available
      if (booking.room.status === "OCCUPIED") {
        await db.room.update({
          where: { id: booking.roomId },
          data: { status: "AVAILABLE" },
        });
      }

      return json({ success: "Booking deleted successfully. It can be restored from the deleted bookings view." });
    }

    if (intent === "restore") {
      const bookingId = formData.get("bookingId") as string;

      // Get booking details
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }

      // Check if booking is actually soft deleted
      if (!booking.deletedAt) {
        return json({ error: "Booking is not deleted" }, { status: 400 });
      }

      // Restore the booking by clearing deletedAt and setting status back to PENDING
      await db.booking.update({
        where: { id: bookingId },
        data: { 
          deletedAt: null,
          status: "PENDING" // Reset to pending status when restored
        },
      });

      return json({ success: "Booking restored successfully" });
    }

    if (intent === "hard-delete") {
      const bookingId = formData.get("bookingId") as string;

      // Get booking details before hard deletion
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }

      // Check if booking is soft deleted first
      if (!booking.deletedAt) {
        return json({ error: "Booking must be soft deleted before permanent deletion" }, { status: 400 });
      }

      // Perform hard deletion - this permanently removes the booking
      await db.booking.delete({
        where: { id: bookingId },
      });

      // If room was occupied, set it back to available
      if (booking.room.status === "OCCUPIED") {
        await db.room.update({
          where: { id: booking.roomId },
          data: { status: "AVAILABLE" },
        });
      }

      return json({ success: "Booking permanently deleted" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Booking action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Bookings() {
  const { user, bookings, showDeleted, paymentStatus } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const location = useLocation();

  // Filter bookings based on search query and status
  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => {
      const matchesSearch = 
        booking.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.room.number.toString().includes(searchQuery.toLowerCase()) ||
        booking.room.type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return filtered;
  }, [bookings, searchQuery, statusFilter]);

  const getStatusColor = (status: Booking["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return "green";
      case "PENDING":
        return "yellow";
      case "CHECKED_IN":
        return "blue";
      case "CHECKED_OUT":
        return "gray";
      case "CANCELLED":
        return "red";
      default:
        return "gray";
    }
  };

  if(location.pathname !== "/dashboard/bookings") return <Outlet />

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>
            {user?.role === "GUEST" ? "My Bookings" : "Bookings Management"}
          </Title>
          {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
            <Button 
              component={Link}
              to="/dashboard/bookings/new"
              leftSection={<IconPlus size={16} />}
            >
              New Booking
            </Button>
          )}
        </Group>

        {actionData && "error" in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData && "success" in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
          >
            {actionData.success}
          </Alert>
        )}

        {/* Security Deposit Reminder */}
        {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Security Deposit Reminder"
            color="blue"
            variant="light"
          >
            <Text size="sm" mb="xs">
              Remember to collect security deposits for confirmed bookings. Standard amount is ₵200.
            </Text>
            <Button
              component="a"
              href="/dashboard/security-deposits"
              size="xs"
              variant="light"
            >
              Manage Security Deposits
            </Button>
          </Alert>
        )}

        {/* Search and Filter Controls */}
        <Card>
          <Group>
            <TextInput
              placeholder="Search bookings..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              style={{ flexGrow: 1 }}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || "all")}
              data={[
                { value: "all", label: "All Statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "CONFIRMED", label: "Confirmed" },
                { value: "CHECKED_IN", label: "Checked In" },
                { value: "CHECKED_OUT", label: "Checked Out" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
              style={{ minWidth: 150 }}
            />
            {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
              <>
                <Form method="get">
                  <Button
                    type="submit"
                    variant={showDeleted ? "filled" : "outline"}
                    color={showDeleted ? "red" : "gray"}
                    size="sm"
                  >
                    <input 
                      type="hidden" 
                      name="showDeleted" 
                      value={showDeleted ? "false" : "true"} 
                    />
                    <input
                      type="hidden"
                      name="paymentStatus"
                      value={paymentStatus}
                    />
                    {showDeleted ? "Hide Deleted" : "Show Deleted"}
                  </Button>
                </Form>
                
                {/* Payment Status Filter Buttons */}
                <Group gap="xs">
                  <Form method="get">
                    <Button
                      type="submit"
                      variant={paymentStatus === "all" ? "filled" : "outline"}
                      color="blue"
                      size="sm"
                    >
                      <input type="hidden" name="paymentStatus" value="all" />
                      <input type="hidden" name="showDeleted" value={showDeleted ? "true" : "false"} />
                      All
                    </Button>
                  </Form>
                  <Form method="get">
                    <Button
                      type="submit"
                      variant={paymentStatus === "unpaid" ? "filled" : "outline"}
                      color="red"
                      size="sm"
                    >
                      <input type="hidden" name="paymentStatus" value="unpaid" />
                      <input type="hidden" name="showDeleted" value={showDeleted ? "true" : "false"} />
                      Unpaid
                    </Button>
                  </Form>
                  <Form method="get">
                    <Button
                      type="submit"
                      variant={paymentStatus === "paid" ? "filled" : "outline"}
                      color="green"
                      size="sm"
                    >
                      <input type="hidden" name="paymentStatus" value="paid" />
                      <input type="hidden" name="showDeleted" value={showDeleted ? "true" : "false"} />
                      Paid
                    </Button>
                  </Form>
                </Group>
              </>
            )}
          </Group>
        </Card>

        {/* Quick Stats */}
        <Group grow>
          <Card>
            <Stack gap="xs" align="center">
              <Text size="xl" fw={700} c="orange">
                {bookings.filter(b => b.status === "PENDING" && !b.payment).length}
              </Text>
              <Text size="sm" c="dimmed">Awaiting Payment</Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap="xs" align="center">
              <Text size="xl" fw={700} c="green">
                {bookings.filter(b => b.status === "CONFIRMED").length}
              </Text>
              <Text size="sm" c="dimmed">Confirmed</Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap="xs" align="center">
              <Text size="xl" fw={700} c="blue">
                {bookings.filter(b => ["CHECKED_IN", "CHECKED_OUT"].includes(b.status)).length}
              </Text>
              <Text size="sm" c="dimmed">Active/Completed</Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap="xs" align="center">
              <Text size="xl" fw={700} c="gray">
                ₵{bookings.filter(b => !b.payment || b.payment.status !== "COMPLETED").reduce((sum, b) => sum + b.totalAmount, 0)}
              </Text>
              <Text size="sm" c="dimmed">Pending Revenue</Text>
            </Stack>
          </Card>
        </Group>

        <Card>
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Showing {filteredBookings.length} of {bookings.length} bookings
              {paymentStatus === "unpaid" && (
                <Text size="sm" c="red" span> (unpaid only)</Text>
              )}
              {paymentStatus === "paid" && (
                <Text size="sm" c="green" span> (paid only)</Text>
              )}
              {showDeleted && (
                <Text size="sm" c="red" span> (including deleted bookings)</Text>
              )}
            </Text>
            <Group gap="md">
              {paymentStatus === "unpaid" && (
                <Text size="sm" c="orange">
                  Showing only unpaid bookings
                </Text>
              )}
              {showDeleted && (
                <Text size="sm" c="dimmed">
                  Deleted bookings appear with a red background
                </Text>
              )}
            </Group>
          </Group>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                    <Table.Th>Guest</Table.Th>
                  )}
                  <Table.Th>Room</Table.Th>
                  <Table.Th>Check-in</Table.Th>
                <Table.Th>Check-out</Table.Th>
                <Table.Th>Guests</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Payment</Table.Th>
                {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                  <Table.Th>Actions</Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredBookings.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    <Stack align="center" gap="sm">
                      <IconInfoCircle size={48} color="gray" />
                      <Text c="dimmed">
                        {searchQuery || statusFilter !== "all" 
                          ? "No bookings found matching your criteria" 
                          : "No bookings available"}
                      </Text>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredBookings.map((booking) => (
                <Table.Tr 
                  key={booking.id}
                  style={{ 
                    opacity: booking.deletedAt ? 0.6 : 1,
                    backgroundColor: booking.deletedAt ? '#ffe0e0' : undefined
                  }}
                >
                  {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                    <Table.Td>
                      <div>
                        <Text fw={500}>
                          {booking.user.firstName} {booking.user.lastName}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {booking.user.email}
                        </Text>
                      </div>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <div>
                      <Text fw={500}>Room {booking.room.number}</Text>
                      <Text size="sm" c="dimmed">
                        Block {booking.room.block} • {booking.room.type.replace("_", " ")}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>{format(new Date(booking.checkIn), "MMM dd, yyyy")}</Table.Td>
                  <Table.Td>{format(new Date(booking.checkOut), "MMM dd, yyyy")}</Table.Td>
                  <Table.Td>{booking.guests}</Table.Td>
                  <Table.Td>₵{booking.totalAmount}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge color={getStatusColor(booking.status)} size="sm">
                        {booking.status.replace("_", " ")}
                      </Badge>
                      {booking.status === "PENDING" && !booking.payment && (
                        <Badge color="orange" size="xs" variant="outline">
                          AWAITING PAYMENT
                        </Badge>
                      )}
                      {booking.deletedAt && (
                        <Badge color="red" size="sm" variant="outline">
                          DELETED
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {booking.payment ? (
                      <Group gap="xs">
                        <Badge 
                          color={booking.payment.status === "COMPLETED" ? "green" : 
                                 booking.payment.status === "PENDING" ? "yellow" : 
                                 booking.payment.status === "FAILED" ? "red" : "gray"} 
                          size="sm"
                        >
                          {booking.payment.status === "COMPLETED" ? "PAID" : booking.payment.status}
                        </Badge>
                        {booking.payment.paidAt && (
                          <Text size="xs" c="dimmed">
                            {format(new Date(booking.payment.paidAt), "MMM dd")}
                          </Text>
                        )}
                      </Group>
                    ) : (
                      <Badge color="red" size="sm" variant="outline">
                        UNPAID
                      </Badge>
                    )}
                  </Table.Td>
                  {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                    <Table.Td>
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            title="Actions"
                          >
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          {!booking.deletedAt ? (
                            <>
                              <Menu.Item
                                component={Link}
                                to={`/dashboard/bookings/${booking.id}`}
                                leftSection={<IconEye size={14} />}
                                color="blue"
                              >
                                View Details
                              </Menu.Item>
                              
                              <Menu.Divider />
                              <Menu.Label>Status</Menu.Label>
                              <Form method="post" style={{ display: "inline" }}>
                                <input type="hidden" name="intent" value="update-status" />
                                <input type="hidden" name="bookingId" value={booking.id} />
                                <Select
                                  name="status"
                                  size="xs"
                                  data={[
                                    { value: "PENDING", label: "Pending" },
                                    { value: "CONFIRMED", label: "Confirmed" },
                                    { value: "CHECKED_IN", label: "Checked In" },
                                    { value: "CHECKED_OUT", label: "Checked Out" },
                                    { value: "CANCELLED", label: "Cancelled" },
                                  ]}
                                  defaultValue={booking.status}
                                  onChange={(value) => {
                                    if (value) {
                                      const form = new FormData();
                                      form.append("intent", "update-status");
                                      form.append("bookingId", booking.id);
                                      form.append("status", value);
                                      fetch("/dashboard/bookings", {
                                        method: "POST",
                                        body: form,
                                      }).then(() => window.location.reload());
                                    }
                                  }}
                                />
                              </Form>
                              
                              <Menu.Divider />
                              <Menu.Label>Actions</Menu.Label>
                              
                              {booking.status === "PENDING" && !booking.payment && (
                                <Menu.Item
                                  component="a"
                                  href={`/dashboard/payments?bookingId=${booking.id}`}
                                  leftSection={<IconPlus size={14} />}
                                  color="green"
                                >
                                  Record Payment
                                </Menu.Item>
                              )}
                              
                              {["PENDING", "CANCELLED"].includes(booking.status) && (
                                <Menu.Item
                                  color="orange"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this booking? It can be restored later.")) {
                                      const form = new FormData();
                                      form.append("intent", "delete");
                                      form.append("bookingId", booking.id);
                                      fetch("/dashboard/bookings", {
                                        method: "POST",
                                        body: form,
                                      }).then(() => window.location.reload());
                                    }
                                  }}
                                >
                                  Delete Booking
                                </Menu.Item>
                              )}
                            </>
                          ) : (
                            <>
                              <Menu.Label>Deleted Booking</Menu.Label>
                              <Menu.Item
                                color="green"
                                onClick={() => {
                                  const form = new FormData();
                                  form.append("intent", "restore");
                                  form.append("bookingId", booking.id);
                                  fetch("/dashboard/bookings", {
                                    method: "POST",
                                    body: form,
                                  }).then(() => window.location.reload());
                                }}
                              >
                                Restore Booking
                              </Menu.Item>
                              
                              {user?.role === "ADMIN" && (
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => {
                                    if (confirm("Are you sure you want to PERMANENTLY delete this booking? This action cannot be undone.")) {
                                      const form = new FormData();
                                      form.append("intent", "hard-delete");
                                      form.append("bookingId", booking.id);
                                      fetch("/dashboard/bookings", {
                                        method: "POST",
                                        body: form,
                                      }).then(() => window.location.reload());
                                    }
                                  }}
                                >
                                  Permanently Delete
                                </Menu.Item>
                              )}
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
              )}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </DashboardLayout>
  );
}
