import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate, useNavigation } from "@remix-run/react";
import {
  Title,
  Paper,
  Stack,
  Group,
  Button,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Card,
  Text,
  Breadcrumbs,
  Anchor,
  Divider,
  Badge,
  LoadingOverlay,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconDeviceFloppy, IconInfoCircle, IconCreditCard, IconUser, IconHome } from "@tabler/icons-react";
import { format } from "date-fns";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { PaymentMethod } from "@prisma/client";
import { mnotifyService } from "~/utils/mnotify.server";
import { useEffect } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Payment - Apartment Management" },
    { name: "description", content: "Record a new payment" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const url = new URL(request.url);
  
  // Get URL parameters
  const bookingId = url.searchParams.get("bookingId");
  const amount = url.searchParams.get("amount");
  const returnTo = url.searchParams.get("returnTo");

  // Get payment accounts from database
  const paymentAccounts = await db.paymentAccount.findMany({
    where: { isActive: true },
    orderBy: [
      { isDefault: "desc" },
      { provider: "asc" },
      { accountName: "asc" },
    ],
  });

  // Get booking details if bookingId is provided
  let booking = null;
  if (bookingId) {
    booking = await db.booking.findUnique({
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
            number: true,
            type: {
              select: {
                displayName: true,
                name: true,
              },
            },
            block: true,
          },
        },
        payment: true,
      },
    });

    // Check if booking already has a payment
    if (booking?.payment) {
      throw new Response("This booking already has a payment recorded", { status: 400 });
    }
  }

  // Get all bookings without payments for dropdown
  const unpaidBookings = await db.booking.findMany({
    where: {
      payment: null,
      status: { in: ["PENDING", "CONFIRMED"] },
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      room: {
        select: {
          number: true,
          type: {
            select: {
              displayName: true,
              name: true,
            },
          },
          block: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({
    user,
    paymentAccounts,
    booking,
    unpaidBookings,
    urlParams: {
      bookingId,
      amount: amount ? parseFloat(amount) : null,
      returnTo,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  // Only staff, managers, and admins can record payments
  if (!user || !["STAFF", "MANAGER", "ADMIN"].includes(user.role)) {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const bookingId = formData.get("bookingId") as string;
  const amountString = formData.get("amount") as string;
  const paymentAccountId = formData.get("paymentAccountId") as string;
  const transactionId = formData.get("transactionId") as string;
  const notes = formData.get("notes") as string;
  const returnTo = formData.get("returnTo") as string;

  // Validation
  if (!bookingId || !amountString || !paymentAccountId) {
    return json({ error: "Please fill in all required fields" }, { status: 400 });
  }

  const amount = parseFloat(amountString);
  if (isNaN(amount) || amount <= 0) {
    return json({ error: "Amount must be a valid number greater than 0" }, { status: 400 });
  }

  try {
    // Get the selected payment account
    const paymentAccount = await db.paymentAccount.findUnique({
      where: { id: paymentAccountId },
    });

    if (!paymentAccount || !paymentAccount.isActive) {
      return json({ error: "Invalid payment account selected" }, { status: 400 });
    }

    // Determine payment method based on account type
    let method: PaymentMethod;
    switch (paymentAccount.type) {
      case "CREDIT_CARD":
        method = "CREDIT_CARD";
        break;
      case "DEBIT_CARD":
        method = "DEBIT_CARD";
        break;
      case "BANK_ACCOUNT":
        method = "BANK_TRANSFER";
        break;
      case "MOBILE_WALLET":
        method = "MOBILE_MONEY";
        break;
      case "DIGITAL_WALLET":
        method = "ONLINE";
        break;
      default:
        method = "ONLINE";
    }

    // Get booking with details
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        room: true,
        payment: true,
      },
    });

    if (!booking) {
      return json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.payment) {
      return json({ error: "This booking already has a payment recorded" }, { status: 400 });
    }

    // Create payment record
    const payment = await db.payment.create({
      data: {
        amount,
        method: method,
        transactionId: transactionId || undefined,
        notes: notes || undefined,
        status: "COMPLETED",
        bookingId,
        paymentAccountId: paymentAccountId,
        paidAt: new Date(),
      },
    });

    // Update booking status to CONFIRMED if it was PENDING
    if (booking.status === "PENDING") {
      await db.booking.update({
        where: { id: bookingId },
        data: { status: "CONFIRMED" },
      });

      // Update room status to OCCUPIED
      await db.room.update({
        where: { id: booking.roomId },
        data: { status: "OCCUPIED" },
      });
    }

    // Send confirmation emails/SMS
    // This feature requires:
    // 1. MNOTIFY_API_KEY environment variable
    // 2. MNOTIFY_SENDER_ID environment variable  
    // 3. ADMIN_PHONE_NUMBER environment variable for admin alerts
    // 4. Guest must have a valid phone number in their profile
    try {
      // Guest payment confirmation email
      // await emailService.sendBookingConfirmation({
      //   firstName: booking.user.firstName,
      //   lastName: booking.user.lastName,
      //   email: booking.user.email,
      //   roomNumber: booking.room.number,
      //   checkIn: format(new Date(booking.checkIn), "MMM dd, yyyy"),
      //   checkOut: format(new Date(booking.checkOut), "MMM dd, yyyy"),
      //   totalAmount: booking.totalAmount,
      //   bookingId: booking.id,
      // });

      // Guest SMS payment confirmation
      if (booking.user.phone) {
        const message = `Dear ${booking.user.firstName} ${booking.user.lastName}, your payment of GH₵${amount.toFixed(2)} via ${method} has been received for Room ${booking.room.number} (${format(new Date(booking.checkIn), "MMM dd, yyyy")} - ${format(new Date(booking.checkOut), "MMM dd, yyyy")}). Transaction ID: ${transactionId || payment.id}. Thank you! - Platinum Apartment`;
        
        await mnotifyService.sendSMS({
          recipient: booking.user.phone,
          message,
          senderId: process.env.MNOTIFY_SENDER_ID
        });
      }

      // Admin SMS notification
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      if (adminPhone) {
        const adminMessage = `Payment Received: ${booking.user.firstName} ${booking.user.lastName} paid GH₵${amount.toFixed(2)} via ${method} for Room ${booking.room.number}. Booking: ${booking.id.slice(-8)}, Transaction: ${transactionId || payment.id} - Platinum Apartment`;
        
        await mnotifyService.sendSMS({
          recipient: adminPhone,
          message: adminMessage,
          senderId: process.env.MNOTIFY_SENDER_ID
        });
      }
    } catch (emailError) {
      console.error("Email/SMS sending failed:", emailError);
      // Don't fail the payment creation if email fails
    }

    // Redirect to return URL or booking detail page with success message
    const redirectUrl = returnTo || `/dashboard/bookings/${bookingId}`;
    const successParams = new URLSearchParams({
      success: "payment-recorded",
      paymentId: payment.id,
      ...(booking.user.phone && { guestNotified: "true" }),
      ...(process.env.ADMIN_PHONE_NUMBER && { adminNotified: "true" })
    });
    return redirect(`${redirectUrl}?${successParams.toString()}`);
  } catch (error) {
    console.error("Payment creation error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function NewPayment() {
  const { user, paymentAccounts, booking, unpaidBookings, urlParams } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";
  const isLoading = navigation.state === "loading";

  const form = useForm({
    initialValues: {
      bookingId: urlParams.bookingId || "",
      amount: urlParams.amount || 0,
      paymentAccountId: "",
      transactionId: "",
      notes: "",
    },
    validate: {
      bookingId: (value) => (!value ? "Please select a booking" : null),
      amount: (value) => {
        if (!value || value <= 0) return "Amount must be greater than 0";
        if (isNaN(Number(value))) return "Amount must be a valid number";
        return null;
      },
      paymentAccountId: (value) => (!value ? "Please select a payment account" : null),
    },
  });

  // Update amount when booking selection changes
  useEffect(() => {
    if (form.values.bookingId && form.values.bookingId !== urlParams.bookingId) {
      const selectedBooking = unpaidBookings.find(b => b.id === form.values.bookingId);
      if (selectedBooking) {
        form.setFieldValue('amount', selectedBooking.totalAmount);
      }
    }
  }, [form.values.bookingId, unpaidBookings, urlParams.bookingId, form]);

  const selectedBooking = booking || unpaidBookings.find(b => b.id === form.values.bookingId);

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Payments", href: "/dashboard/payments" },
    { title: "New Payment", href: "#" },
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

  const bookingOptions = unpaidBookings.map(booking => ({
    value: booking.id,
    label: `Room ${booking.room.number} - ${booking.user.firstName} ${booking.user.lastName} (GH₵ ${booking.totalAmount.toFixed(2)})`,
  }));

  const paymentAccountOptions = paymentAccounts.map((account) => {
    let label = `${account.provider} (${account.type.replace('_', ' ')})`;
    
    if (account.accountName) {
      label += ` - ${account.accountName}`;
    }
    
    if (account.cardLast4) {
      label += ` (**** ${account.cardLast4})`;
    } else if (account.accountNumber) {
      label += ` (**** ${account.accountNumber})`;
    }
    
    if (account.isDefault) {
      label += " (Default)";
    }
    
    return {
      value: account.id,
      label: label,
    };
  });

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Breadcrumbs separator=">">{breadcrumbItems}</Breadcrumbs>
            <Title order={2} mt="xs">
              Record New Payment
            </Title>
          </div>
          <Button
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            disabled={isSubmitting}
            onClick={() => {
              if (urlParams.returnTo) {
                window.location.href = urlParams.returnTo;
              } else {
                navigate("/dashboard/payments");
              }
            }}
          >
            Back
          </Button>
        </Group>

        {actionData?.error && (
          <Alert variant="light" color="red" icon={<IconInfoCircle size={16} />}>
            {actionData.error}
          </Alert>
        )}

        {isLoading && (
          <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
            Loading payment data...
          </Alert>
        )}

        <Group gap="md" align="flex-start">
          {/* Payment Form */}
          <Card withBorder style={{ flex: 2, position: 'relative' }}>
            <LoadingOverlay visible={isLoading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
            <Form method="post">
              <Stack gap="md">
                <Text size="lg" fw={600}>Payment Details</Text>

                <input type="hidden" name="returnTo" value={urlParams.returnTo || ""} />
                <input type="hidden" name="bookingId" value={form.values.bookingId} />
                <input type="hidden" name="amount" value={form.values.amount.toString()} />
                <input type="hidden" name="paymentAccountId" value={form.values.paymentAccountId} />
                <input type="hidden" name="transactionId" value={form.values.transactionId} />
                <input type="hidden" name="notes" value={form.values.notes} />

                <Select
                  label="Booking"
                  placeholder="Select a booking"
                  data={bookingOptions}
                  required
                  disabled={!!urlParams.bookingId || isSubmitting}
                  searchable
                  {...form.getInputProps('bookingId')}
                />

                <NumberInput
                  label="Payment Amount (GH₵)"
                  placeholder="0.00"
                  min={0}
                  decimalScale={2}
                  fixedDecimalScale
                  required
                  disabled={isSubmitting}
                  {...form.getInputProps('amount')}
                />

                <Select
                  label="Payment Account"
                  placeholder="Select payment account"
                  data={paymentAccountOptions}
                  required
                  disabled={isSubmitting}
                  {...form.getInputProps('paymentAccountId')}
                />

                <TextInput
                  label="Transaction ID (Optional)"
                  placeholder="Enter transaction reference"
                  disabled={isSubmitting}
                  {...form.getInputProps('transactionId')}
                />

                <Textarea
                  label="Notes (Optional)"
                  placeholder="Add any additional notes about this payment"
                  rows={3}
                  disabled={isSubmitting}
                  {...form.getInputProps('notes')}
                />

                <Group justify="flex-end" mt="md">
                  <Button
                    type="button"
                    variant="light"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (urlParams.returnTo) {
                        window.location.href = urlParams.returnTo;
                      } else {
                        navigate("/dashboard/payments");
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    leftSection={<IconDeviceFloppy size={16} />}
                    disabled={!form.isValid() || !form.values.bookingId || !form.values.amount || !form.values.paymentAccountId || isSubmitting}
                    loading={isSubmitting}
                  >
                    {isSubmitting ? "Recording Payment..." : "Record Payment"}
                  </Button>
                </Group>
              </Stack>
            </Form>
          </Card>

          {/* Booking Summary */}
          {selectedBooking && (
            <Card withBorder style={{ flex: 1, position: 'relative' }}>
              <LoadingOverlay visible={isSubmitting} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Text size="lg" fw={600}>Booking Summary</Text>
                  <Badge color="blue" size="sm">
                    {selectedBooking.status}
                  </Badge>
                </Group>

                <Divider />

                <div>
                  <Group gap="xs" mb="xs">
                    <IconUser size={16} />
                    <Text size="sm" fw={500}>Guest</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {selectedBooking.user.firstName} {selectedBooking.user.lastName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedBooking.user.email}
                  </Text>
                </div>

                <div>
                  <Group gap="xs" mb="xs">
                    <IconHome size={16} />
                    <Text size="sm" fw={500}>Room</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Room {selectedBooking.room.number}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedBooking.room.type.displayName} - {selectedBooking.room.block}
                  </Text>
                </div>

                <div>
                  <Group gap="xs" mb="xs">
                    <IconCreditCard size={16} />
                    <Text size="sm" fw={500}>Stay Details</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Check-in: {format(new Date(selectedBooking.checkIn), "MMM dd, yyyy")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Check-out: {format(new Date(selectedBooking.checkOut), "MMM dd, yyyy")}
                  </Text>
                  <Text size="sm" fw={500} mt="xs">
                    Total: GH₵ {selectedBooking.totalAmount.toFixed(2)}
                  </Text>
                </div>

                {selectedBooking.specialRequests && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">Special Requests</Text>
                    <Paper bg="gray.0" p="xs" radius="sm">
                      <Text size="xs">{selectedBooking.specialRequests}</Text>
                    </Paper>
                  </div>
                )}
              </Stack>
            </Card>
          )}
        </Group>
      </Stack>
    </DashboardLayout>
  );
}
