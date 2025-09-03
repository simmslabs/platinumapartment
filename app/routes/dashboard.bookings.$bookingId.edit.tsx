import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate } from "@remix-run/react";
import {
  Title,
  Button,
  Stack,
  Group,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Card,
  Text,
  Breadcrumbs,
  Anchor,
  Paper,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconArrowLeft, IconDeviceFloppy, IconInfoCircle } from "@tabler/icons-react";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { db } from "~/utils/db.server";
import { RoomStatus } from "@prisma/client";
import { requireUserId, getUser } from "~/utils/session.server";
import DashboardLayout from "~/components/DashboardLayout";
import { updateRoomStatus } from "~/utils/room-status.server";

// Pricing utility functions
const calculateCheckoutDate = (checkInDate: Date, periods: number, pricingPeriod: string): Date => {
  const checkOut = new Date(checkInDate);
  
  switch (pricingPeriod.toUpperCase()) {
    case 'NIGHT':
      checkOut.setDate(checkOut.getDate() + periods);
      break;
    case 'WEEK':
      checkOut.setDate(checkOut.getDate() + (periods * 7));
      break;
    case 'MONTH':
      checkOut.setMonth(checkOut.getMonth() + periods);
      break;
    case 'YEAR':
      checkOut.setFullYear(checkOut.getFullYear() + periods);
      break;
    default:
      // Default to nights
      checkOut.setDate(checkOut.getDate() + periods);
  }
  
  return checkOut;
};

const getPricingPeriodDisplay = (period: string): string => {
  switch (period.toUpperCase()) {
    case 'NIGHT': return 'night';
    case 'WEEK': return 'week';
    case 'MONTH': return 'month';
    case 'YEAR': return 'year';
    default: return 'night';
  }
};

const calculateDailyEquivalent = (pricePerPeriod: number, period: string): number => {
  switch (period.toUpperCase()) {
    case 'NIGHT': return pricePerPeriod;
    case 'WEEK': return pricePerPeriod / 7;
    case 'MONTH': return pricePerPeriod / 30; // Approximate
    case 'YEAR': return pricePerPeriod / 365; // Approximate
    default: return pricePerPeriod;
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: "Edit Booking - Apartment Management" },
    { name: "description", content: "Edit booking details" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const bookingId = params.bookingId;

  if (!bookingId) {
    throw new Response("Booking ID is required", { status: 400 });
  }

  // Get the booking details
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: { 
          id: true, 
          firstName: true, 
          lastName: true, 
          email: true 
        },
      },
      room: {
        include: {
          blockRelation: true,
          type: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  // Check if user has permission to edit this booking
  if (user?.role === "TENANT" && booking.userId !== user.id) {
    throw new Response("Unauthorized", { status: 403 });
  }

  // Get all guests for the dropdown
  const guests = await db.user.findMany({
    where: { role: "TENANT" },
    select: { 
      id: true, 
      firstName: true, 
      lastName: true, 
      email: true 
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  // Get available rooms (include current room even if occupied)
  const rooms = await db.room.findMany({
    where: {
      OR: [
        { status: RoomStatus.AVAILABLE },
        { id: booking.roomId } // Include current room
      ]
    },
    include: {
      blockRelation: true,
      type: true,
    },
    orderBy: { number: "asc" },
  });

  return json({ 
    user, 
    guests, 
    rooms, 
    booking
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const bookingId = params.bookingId;

  if (!bookingId) {
    throw new Response("Booking ID is required", { status: 400 });
  }

  try {
    const userId = formData.get("userId") as string;
    const roomId = formData.get("roomId") as string;
    const checkInStr = formData.get("checkIn") as string;
    const numberOfPeriodsStr = formData.get("numberOfPeriods") as string;
    const guestsStr = formData.get("guests") as string;
    const specialRequests = formData.get("specialRequests") as string;

    // Validation
    if (!userId || !roomId || !checkInStr || !numberOfPeriodsStr || !guestsStr) {
      return json({ error: "All required fields must be filled." }, { status: 400 });
    }

    const numberOfPeriods = parseInt(numberOfPeriodsStr);
    const guests = parseInt(guestsStr);
    const checkIn = new Date(checkInStr);

    if (isNaN(numberOfPeriods) || numberOfPeriods < 1) {
      return json({ error: "Number of periods must be at least 1." }, { status: 400 });
    }

    if (isNaN(guests) || guests < 1) {
      return json({ error: "Number of guests must be at least 1." }, { status: 400 });
    }

    // Get the current booking
    const currentBooking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { room: true }
    });

    if (!currentBooking) {
      return json({ error: "Booking not found." }, { status: 404 });
    }

    // Get room details for pricing calculation
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { pricePerNight: true, pricingPeriod: true }
    });

    if (!room) {
      return json({ error: "Selected room not found." }, { status: 400 });
    }

    // Calculate check-out date and total amount
    const checkOut = calculateCheckoutDate(checkIn, numberOfPeriods, room.pricingPeriod || 'NIGHT');
    const totalAmount = room.pricePerNight * numberOfPeriods;

    // Check for date conflicts with other bookings (excluding current booking)
    const conflictingBooking = await db.booking.findFirst({
      where: {
        roomId,
        id: { not: bookingId }, // Exclude current booking
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return json({ 
        error: "The selected room is not available for the chosen dates due to another booking." 
      }, { status: 400 });
    }

    // Update the booking
    const updatedBooking = await db.booking.update({
      where: { id: bookingId },
      data: {
        userId,
        roomId,
        checkIn,
        checkOut,
        guests,
        specialRequests: specialRequests || null,
        totalAmount,
        // Keep the same status unless specified otherwise
      },
      include: {
        user: true,
        room: true,
      },
    });

    console.log("Booking updated successfully:", updatedBooking.id);

    // Update room statuses if room changed
    if (currentBooking.roomId !== roomId) {
      // Update old room status
      await updateRoomStatus(currentBooking.roomId);
      
      // Update new room status
      await updateRoomStatus(roomId);
      
      console.log(`Room statuses updated - old room: ${currentBooking.room.number}, new room: ${updatedBooking.room.number}`);
    } else {
      // Update current room status in case dates changed
      await updateRoomStatus(roomId);
    }

    return redirect(`/dashboard/bookings/${bookingId}?success=booking-updated`);
  } catch (error) {
    console.error("Booking update error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function EditBooking() {
  const { 
    user, 
    guests, 
    rooms, 
    booking
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // Form state
  const [selectedUserId, setSelectedUserId] = useState(booking.userId);
  const [selectedRoom, setSelectedRoom] = useState(booking.roomId);
  const [checkInDate, setCheckInDate] = useState<Date | null>(new Date(booking.checkIn));
  const [numberOfPeriods, setNumberOfPeriods] = useState(1);
  const [guests_count, setGuestsCount] = useState(booking.guests);
  const [specialRequests, setSpecialRequests] = useState(booking.specialRequests || "");

  // Calculate initial number of periods based on existing booking
  useEffect(() => {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const room = rooms.find(r => r.id === booking.roomId);
    
    if (room) {
      const pricingPeriod = room.pricingPeriod || 'NIGHT';
      let periods = 1;
      
      if (pricingPeriod === 'NIGHT') {
        periods = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      } else if (pricingPeriod === 'WEEK') {
        periods = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24 * 7));
      } else if (pricingPeriod === 'MONTH') {
        periods = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24 * 30));
      }
      
      setNumberOfPeriods(Math.max(1, periods));
    }
  }, [booking, rooms]);

  // Calculate pricing preview
  const pricingPreview = useMemo(() => {
    if (!selectedRoom || !checkInDate || !numberOfPeriods) return null;
    
    const room = rooms.find(r => r.id === selectedRoom);
    if (!room) return null;

    const checkOutDate = calculateCheckoutDate(checkInDate, numberOfPeriods, room.pricingPeriod || 'NIGHT');
    const stayDurationDays = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAmount = room.pricePerNight * numberOfPeriods;
    const period = getPricingPeriodDisplay(room.pricingPeriod || 'NIGHT');
    const dailyRate = calculateDailyEquivalent(room.pricePerNight, room.pricingPeriod || 'NIGHT');

    return {
      checkOutDate: format(checkOutDate, "MMM dd, yyyy"),
      stayDurationDays,
      periodCount: numberOfPeriods,
      periodName: numberOfPeriods === 1 ? period : period + 's',
      period,
      basePrice: room.pricePerNight,
      dailyRate,
      totalAmount,
    };
  }, [selectedRoom, checkInDate, numberOfPeriods, rooms]);

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Bookings", href: "/dashboard/bookings" },
    { title: "Booking Details", href: `/dashboard/bookings/${booking.id}` },
    { title: "Edit", href: "#" },
  ].map((item, index) => (
    <Anchor 
      key={index} 
      href={item.href} 
      c={index === 3 ? "dimmed" : "blue"}
      onClick={(e) => {
        if (item.href !== "#") {
          e.preventDefault();
          navigate(item.href);
        }
      }}
    >
      {item.title}
    </Anchor>
  ));

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Breadcrumbs separator=">">{breadcrumbItems}</Breadcrumbs>
            <Title order={2} mt="xs">
              Edit Booking
            </Title>
          </div>
          <Button
            onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Booking
          </Button>
        </Group>

        {actionData?.error && (
          <Alert variant="light" color="red" icon={<IconInfoCircle size={16} />}>
            {actionData.error}
          </Alert>
        )}

        <Paper p="md" withBorder>
          <Form method="post">
            <Stack gap="md">
              {/* Guest Selection */}
              <Select
                label="Guest"
                placeholder="Select a guest"
                data={guests.map(guest => ({
                  value: guest.id,
                  label: `${guest.firstName} ${guest.lastName} (${guest.email})`
                }))}
                value={selectedUserId}
                onChange={(value) => setSelectedUserId(value || "")}
                name="userId"
                required
                searchable
                clearable={false}
              />

              {/* Room Selection */}
              <Select
                label="Room"
                placeholder="Select a room"
                data={(rooms || []).map(room => {
                  const blockName = room.blockRelation?.name || room.block;
                  const statusBadge = room.status !== 'AVAILABLE' ? ` (${room.status})` : '';
                  
                  return {
                    value: room.id,
                    label: `${room.number} - ${blockName} - ${room.type.displayName} - GH₵ ${room.pricePerNight.toFixed(2)}/${getPricingPeriodDisplay(room.pricingPeriod || 'NIGHT')}${statusBadge}`
                  };
                })}
                value={selectedRoom}
                onChange={(value) => setSelectedRoom(value || "")}
                name="roomId"
                required
                searchable
                clearable={false}
              />

              {/* Check-in Date */}
              <DateInput
                label="Check-in Date"
                placeholder="Select check-in date"
                value={checkInDate}
                onChange={(value) => {
                  if (typeof value === 'string') {
                    setCheckInDate(value ? new Date(value) : null);
                  } else {
                    setCheckInDate(value);
                  }
                }}
                name="checkIn"
                required
                valueFormat="YYYY-MM-DD"
              />

              {/* Number of Periods */}
              <NumberInput
                label={`Number of ${selectedRoom ? getPricingPeriodDisplay(rooms.find(r => r.id === selectedRoom)?.pricingPeriod || 'NIGHT') + 's' : 'periods'}`}
                placeholder="Enter number of periods"
                value={numberOfPeriods}
                onChange={(value) => setNumberOfPeriods(typeof value === 'number' ? value : 1)}
                name="numberOfPeriods"
                min={1}
                required
              />

              {/* Number of Guests */}
              <NumberInput
                label="Number of Guests"
                placeholder="Enter number of guests"
                value={guests_count}
                onChange={(value) => setGuestsCount(typeof value === 'number' ? value : 1)}
                name="guests"
                min={1}
                required
              />

              {/* Special Requests */}
              <Textarea
                label="Special Requests"
                placeholder="Any special requests or notes..."
                value={specialRequests}
                onChange={(event) => setSpecialRequests(event.currentTarget.value)}
                name="specialRequests"
                rows={3}
              />

              {/* Pricing Preview */}
              {pricingPreview && (
                <Card withBorder p="md" bg="gray.0">
                  <Stack gap="xs">
                    <Text fw={600} size="sm">Booking Summary</Text>
                    <Group justify="space-between">
                      <Text size="sm">Check-out Date:</Text>
                      <Text size="sm" fw={500}>{pricingPreview.checkOutDate}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Duration:</Text>
                      <Text size="sm" fw={500}>{pricingPreview.stayDurationDays} days ({pricingPreview.periodCount} {pricingPreview.periodName})</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Rate:</Text>
                      <Text size="sm" fw={500}>GH₵ {pricingPreview.basePrice.toFixed(2)} per {pricingPreview.period}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Daily Equivalent:</Text>
                      <Text size="sm" fw={500}>GH₵ {pricingPreview.dailyRate.toFixed(2)} per day</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={600}>Total Amount:</Text>
                      <Text fw={600} c="blue">GH₵ {pricingPreview.totalAmount.toFixed(2)}</Text>
                    </Group>
                  </Stack>
                </Card>
              )}

              {/* Action Buttons */}
              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
                  onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  leftSection={<IconDeviceFloppy size={16} />}
                  disabled={!selectedUserId || !selectedRoom || !checkInDate || !numberOfPeriods || !guests_count}
                >
                  Update Booking
                </Button>
              </Group>
            </Stack>
          </Form>
        </Paper>
      </Stack>
    </DashboardLayout>
  );
}
