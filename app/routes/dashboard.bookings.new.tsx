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
import { format } from "date-fns";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { mnotifyService } from "~/utils/mnotify.server";
import { useState, useEffect, useMemo } from "react";

// Helper function to calculate checkout date based on periods with 24-hour periods
const calculateCheckoutDate = (checkInDate: Date, periods: number, pricingPeriod: string): Date => {
  const checkout = new Date(checkInDate);
  
  switch (pricingPeriod) {
    case 'NIGHT':
    case 'DAY':
      checkout.setTime(checkout.getTime() + (periods * 24 * 60 * 60 * 1000));
      break;
    case 'WEEK':
      checkout.setTime(checkout.getTime() + (periods * 7 * 24 * 60 * 60 * 1000));
      break;
    case 'MONTH':
      checkout.setMonth(checkout.getMonth() + periods);
      break;
    case 'YEAR':
      checkout.setFullYear(checkout.getFullYear() + periods);
      break;
    default:
      checkout.setTime(checkout.getTime() + (periods * 24 * 60 * 60 * 1000));
  }
  
  return checkout;
};

const formatDateForForm = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getPricingPeriodDisplay = (period: string): string => {
  switch (period) {
    case 'NIGHT': return 'night';
    case 'DAY': return 'day';
    case 'WEEK': return 'week';
    case 'MONTH': return 'month';
    case 'YEAR': return 'year';
    default: return 'night';
  }
};

const calculateDailyEquivalent = (pricePerPeriod: number, period: string): number => {
  switch (period) {
    case 'NIGHT':
    case 'DAY':
      return pricePerPeriod;
    case 'WEEK':
      return pricePerPeriod / 7;
    case 'MONTH':
      return pricePerPeriod / 30;
    case 'YEAR':
      return pricePerPeriod / 365;
    default:
      return pricePerPeriod;
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: "Create New Booking - Apartment Management" },
    { name: "description", content: "Create a new booking for a guest" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const url = new URL(request.url);
  const guestId = url.searchParams.get("guestId");

  // Get all guests for the dropdown
  const guests = await db.user.findMany({
    where: { role: "GUEST" },
    select: { 
      id: true, 
      firstName: true, 
      lastName: true, 
      email: true 
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  // Get available rooms (not currently occupied)
  const rooms = await db.room.findMany({
    where: {
      status: "AVAILABLE",
    },
    include: {
      blockRelation: true,
      type: true,
    },
    orderBy: { number: "asc" },
  });

  // If guestId is provided, get the specific guest
  let selectedGuest = null;
  if (guestId) {
    selectedGuest = await db.user.findUnique({
      where: { id: guestId },
      select: { 
        id: true, 
        firstName: true, 
        lastName: true, 
        email: true 
      },
    });
  }

  return json({ user, guests, rooms, selectedGuest, guestId });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();

  try {
    const userId = formData.get("userId") as string;
    const roomId = formData.get("roomId") as string;
    const checkInStr = formData.get("checkIn") as string;
    const numberOfPeriodsStr = formData.get("numberOfPeriods") as string;
    const guestsStr = formData.get("guests") as string;
    const specialRequests = formData.get("specialRequests") as string;

    if (!userId || !roomId || !checkInStr || !numberOfPeriodsStr || !guestsStr) {
      return json({ error: "All required fields must be filled" }, { status: 400 });
    }

    const numberOfPeriods = parseInt(numberOfPeriodsStr);
    const guests = parseInt(guestsStr);
    const checkIn = new Date(checkInStr);

    if (isNaN(numberOfPeriods) || isNaN(guests)) {
      return json({ error: "Number of periods and guests must be valid numbers" }, { status: 400 });
    }

    // Get room and pricing information
    const room = await db.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return json({ error: "Room not found" }, { status: 400 });
    }

    // Calculate checkout date and total amount
    const checkOut = calculateCheckoutDate(checkIn, numberOfPeriods, room.pricingPeriod || 'NIGHT');
    const totalAmount = room.pricePerNight * numberOfPeriods;

    // Create the booking
    const newBooking = await db.booking.create({
      data: {
        userId,
        roomId,
        checkIn,
        checkOut,
        guests,
        specialRequests: specialRequests || null,
        totalAmount,
        status: "PENDING",
      },
      include: {
        user: true,
        room: true,
      },
    });

    console.log("Booking created successfully:", newBooking.id);

    // Send confirmation emails
    try {
      // Guest confirmation email
      // await emailService.sendBookingConfirmation({
      //   firstName: newBooking.user.firstName,
      //   lastName: newBooking.user.lastName,
      //   email: newBooking.user.email,
      //   roomNumber: newBooking.room.number,
      //   checkIn: format(checkIn, "MMM dd, yyyy"),
      //   checkOut: format(checkOut, "MMM dd, yyyy"),
      //   totalAmount: totalAmount,
      //   bookingId: newBooking.id,
      // });

      // SMS notification if phone number exists
      if (newBooking.user.phone) {
        const checkInFormatted = format(new Date(newBooking.checkIn), "MMM dd, yyyy");
        const checkOutFormatted = format(new Date(newBooking.checkOut), "MMM dd, yyyy");
        
        await mnotifyService.sendBookingConfirmation(
          newBooking.user.phone,
          `${newBooking.user.firstName} ${newBooking.user.lastName}`,
          newBooking.room.number,
          checkInFormatted,
          checkOutFormatted
        );
      }
    } catch (emailError) {
      console.error("Email/SMS sending failed:", emailError);
      // Don't fail the booking creation if email fails
    }

    return redirect(`/dashboard/bookings?success=booking-created&bookingId=${newBooking.id}`);
  } catch (error) {
    console.error("Booking creation error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function NewBooking() {
  const { user, guests, rooms, selectedGuest, guestId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // Form state
  const [selectedUserId, setSelectedUserId] = useState(guestId || "");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [numberOfPeriods, setNumberOfPeriods] = useState(1);

  // Set the selected guest if coming from guest detail page
  useEffect(() => {
    if (selectedGuest) {
      setSelectedUserId(selectedGuest.id);
    }
  }, [selectedGuest]);

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

  const availableRooms = rooms.filter(room => room.status === "AVAILABLE");

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Bookings", href: "/dashboard/bookings" },
    { title: "New Booking", href: "#" },
  ].map((item, index) => (
    <Anchor 
      key={index} 
      href={item.href} 
      c={index === 2 ? "dimmed" : "blue"}
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
        <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>
        
        <Group justify="space-between">
          <div>
            <Title order={2}>Create New Booking</Title>
            <Text size="sm" c="dimmed">
              {selectedGuest 
                ? `Creating booking for ${selectedGuest.firstName} ${selectedGuest.lastName}`
                : "Create a new booking for a guest"
              }
            </Text>
          </div>
          <Button 
            variant="light" 
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/dashboard/bookings")}
          >
            Back to Bookings
          </Button>
        </Group>

        {actionData?.error && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
          >
            {actionData.error}
          </Alert>
        )}

        <Paper p="md" withBorder>
          <Form method="post">
            <input type="hidden" name="numberOfPeriods" value={numberOfPeriods.toString()} />
            <input type="hidden" name="roomId" value={selectedRoom || ''} />
            <input type="hidden" name="checkIn" value={checkInDate ? formatDateForForm(checkInDate) : ''} />
            
            <Stack gap="md">
              <Select
                label="Guest"
                placeholder="Select guest"
                name="userId"
                value={selectedUserId}
                onChange={(value) => setSelectedUserId(value || "")}
                data={guests.map(guest => ({
                  value: guest.id,
                  label: `${guest.firstName} ${guest.lastName} (${guest.email})`
                }))}
                required
                searchable
                description={selectedGuest ? "Guest pre-selected from guest detail page" : ""}
              />

              <Select
                label="Room"
                placeholder="Select room"
                value={selectedRoom}
                onChange={(value) => setSelectedRoom(value || "")}
                data={availableRooms.map(room => {
                  const periodDisplay = getPricingPeriodDisplay(room.pricingPeriod || 'NIGHT');
                  const dailyEquivalent = calculateDailyEquivalent(room.pricePerNight, room.pricingPeriod || 'NIGHT');
                  const roomWithType = room as typeof room & { type: { displayName: string } };
                  const roomTypeName = roomWithType.type?.displayName || 'Unknown Type';
                  return {
                    value: room.id,
                    label: `Room ${room.number} (Block ${room.block}) - ${roomTypeName} - ₵${room.pricePerNight}/${periodDisplay} (≈₵${dailyEquivalent.toFixed(2)}/day)`
                  };
                })}
                required
                searchable
              />

              <Group grow>
                <DateInput
                  label="Check-in Date"
                  placeholder="Select date"
                  value={checkInDate}
                  onChange={(value) => {
                    if (typeof value === 'string') {
                      setCheckInDate(value ? new Date(value) : null);
                    } else {
                      setCheckInDate(value);
                    }
                  }}
                  required
                  minDate={new Date()}
                  valueFormat="YYYY-MM-DD"
                />
                <NumberInput
                  label={`Number of ${selectedRoom ? getPricingPeriodDisplay(availableRooms.find(r => r.id === selectedRoom)?.pricingPeriod || 'NIGHT') + 's' : 'periods'}`}
                  placeholder="1"
                  value={numberOfPeriods}
                  onChange={(value) => setNumberOfPeriods(typeof value === 'number' ? value : 1)}
                  min={1}
                  required
                  description={pricingPreview?.checkOutDate ? `Check-out: ${pricingPreview.checkOutDate}` : ''}
                />
              </Group>

              {/* Pricing Preview */}
              {pricingPreview && (
                <Card withBorder p="md" bg="gray.0">
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="blue">Booking Summary</Text>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Stay Duration:</Text>
                      <Text size="sm">{pricingPreview.stayDurationDays} {pricingPreview.stayDurationDays === 1 ? 'day' : 'days'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Billing Periods:</Text>
                      <Text size="sm" fw={500}>{pricingPreview.periodCount} {pricingPreview.periodName}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Rate per {pricingPreview.period}:</Text>
                      <Text size="sm">₵{pricingPreview.basePrice}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Daily equivalent:</Text>
                      <Text size="sm">₵{pricingPreview.dailyRate.toFixed(2)}/day</Text>
                    </Group>
                    {pricingPreview.period !== 'day' && pricingPreview.period !== 'night' && (
                      <Alert color="blue" variant="light" p="xs">
                        <Text size="xs">
                          Fixed pricing: You pay the full {pricingPreview.period} rate even for partial periods
                        </Text>
                      </Alert>
                    )}
                    <Group justify="space-between">
                      <Text fw={500}>Total Amount:</Text>
                      <Text fw={500} c="blue">₵{pricingPreview.totalAmount.toFixed(2)}</Text>
                    </Group>
                  </Stack>
                </Card>
              )}

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
                <Button 
                  variant="light" 
                  onClick={() => navigate("/dashboard/bookings")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  leftSection={<IconDeviceFloppy size={16} />}
                >
                  Create Booking
                </Button>
              </Group>
            </Stack>
          </Form>
        </Paper>
      </Stack>
    </DashboardLayout>
  );
}
