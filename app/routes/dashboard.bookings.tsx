import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Text,
  Card,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconTrash, IconSearch } from "@tabler/icons-react";
import { format } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Booking, Room, User } from "@prisma/client";
import { emailService } from "~/utils/email.server";
import { useState, useMemo } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Bookings - Apartment Management" },
    { name: "description", content: "Manage apartment bookings" },
  ];
};

type BookingWithDetails = Booking & {
  user: Pick<User, "firstName" | "lastName" | "email">;
  room: Pick<Room, "number" | "type">;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);

  // Filter bookings based on user role
  const bookingFilter = user?.role === "GUEST" 
    ? { userId: userId } // Guests only see their own bookings
    : {}; // Admin/Manager/Staff see all bookings

  const bookings = await db.booking.findMany({
    where: bookingFilter,
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
      room: {
        select: { number: true, type: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const availableRooms = await db.room.findMany({
    where: { status: "AVAILABLE" },
    select: { id: true, number: true, type: true, pricePerNight: true },
  });

  const guests = await db.user.findMany({
    where: { role: "GUEST" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  return json({ user, bookings, availableRooms, guests });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const userId = formData.get("userId") as string;
      const roomId = formData.get("roomId") as string;
      const checkIn = new Date(formData.get("checkIn") as string);
      const checkOut = new Date(formData.get("checkOut") as string);
      const guests = parseInt(formData.get("guests") as string);
      const specialRequests = formData.get("specialRequests") as string;

      if (!userId || !roomId || !checkIn || !checkOut || !guests) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }

      if (checkIn >= checkOut) {
        return json({ error: "Check-out date must be after check-in date" }, { status: 400 });
      }

      // Get room price
      const room = await db.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return json({ error: "Room not found" }, { status: 400 });
      }

      // Calculate total amount
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = nights * room.pricePerNight;

      // Get user details for email
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return json({ error: "User not found" }, { status: 400 });
      }

      const newBooking = await db.booking.create({
        data: {
          userId,
          roomId,
          checkIn,
          checkOut,
          guests,
          totalAmount,
          specialRequests: specialRequests || null,
          status: "CONFIRMED",
        },
      });

      // Send booking confirmation email (don't block the response if email fails)
      try {
        await emailService.sendBookingConfirmation({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roomNumber: room.number,
          checkIn: checkIn.toLocaleDateString(),
          checkOut: checkOut.toLocaleDateString(),
          totalAmount,
          bookingId: newBooking.id,
          securityDepositRequired: true, // Add security deposit notification
          securityDepositAmount: 200, // Standard security deposit amount
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
      const status = formData.get("status") as any;

      await db.booking.update({
        where: { id: bookingId },
        data: { status },
      });

      // Update room status based on booking status
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (booking) {
        let roomStatus = "AVAILABLE";
        if (status === "CHECKED_IN") {
          roomStatus = "OCCUPIED";
        }
        
        await db.room.update({
          where: { id: booking.roomId },
          data: { status: roomStatus as any },
        });
      }

      return json({ success: "Booking status updated successfully" });
    }

    if (intent === "delete") {
      const bookingId = formData.get("bookingId") as string;

      // Get booking details before deletion
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }

      // Only allow deletion of PENDING or CANCELLED bookings
      if (!["PENDING", "CANCELLED"].includes(booking.status)) {
        return json({ error: "Only pending or cancelled bookings can be deleted" }, { status: 400 });
      }

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

      return json({ success: "Booking deleted successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Booking action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Bookings() {
  const { user, bookings, availableRooms, guests } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter bookings based on search query and status
  const filteredBookings = useMemo(() => {
    let filtered = bookings.filter((booking) => {
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

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>
            {user?.role === "GUEST" ? "My Bookings" : "Bookings Management"}
          </Title>
          {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
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
          </Group>
        </Card>

        <Card>
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Showing {filteredBookings.length} of {bookings.length} bookings
            </Text>
          </Group>
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
                <Table.Tr key={booking.id}>
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
                        {booking.room.type.replace("_", " ")}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>{format(new Date(booking.checkIn), "MMM dd, yyyy")}</Table.Td>
                  <Table.Td>{format(new Date(booking.checkOut), "MMM dd, yyyy")}</Table.Td>
                  <Table.Td>{booking.guests}</Table.Td>
                  <Table.Td>₵{booking.totalAmount}</Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(booking.status)} size="sm">
                      {booking.status.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                    <Table.Td>
                      <Group gap="xs">
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
                        {["PENDING", "CANCELLED"].includes(booking.status) && (
                          <Form method="post" style={{ display: "inline" }}>
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="bookingId" value={booking.id} />
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              type="submit"
                              size="sm"
                              onClick={(e) => {
                                if (!confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Form>
                        )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
              )}
            </Table.Tbody>
          </Table>
        </Card>

        <Modal opened={opened} onClose={close} title="Create New Booking" size="lg">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Stack>
              <Select
                label="Guest"
                placeholder="Select guest"
                name="userId"
                data={guests.map(guest => ({
                  value: guest.id,
                  label: `${guest.firstName} ${guest.lastName} (${guest.email})`
                }))}
                required
                searchable
              />

              <Select
                label="Room"
                placeholder="Select room"
                name="roomId"
                data={availableRooms.map(room => ({
                  value: room.id,
                  label: `Room ${room.number} (Block ${room.block}) - ${room.type} (₵${room.pricePerNight}/night)`
                }))}
                required
                searchable
              />

              <Group grow>
                <DateInput
                  label="Check-in Date"
                  placeholder="Select date"
                  name="checkIn"
                  required
                  minDate={new Date()}
                />
                <DateInput
                  label="Check-out Date"
                  placeholder="Select date"
                  name="checkOut"
                  required
                  minDate={new Date()}
                />
              </Group>

              <NumberInput
                label="Number of Guests"
                placeholder="2"
                name="guests"
                min={1}
                required
              />

              <Textarea
                label="Special Requests"
                placeholder="Any special requests..."
                name="specialRequests"
                rows={3}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" onClick={close}>
                  Create Booking
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
