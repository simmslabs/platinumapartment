import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData } from "@remix-run/react";
import {
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Card,
  Grid,
  Breadcrumbs,
  Anchor,
  Select,
  NumberInput,
  TextInput,
  LoadingOverlay,
  Notification,
  Box,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { IconArrowLeft, IconCreditCard, IconCheck, IconX } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { mnotifyService } from "~/utils/mnotify.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Receive Security Deposit - Apartment Management" },
    { name: "description", content: "Record security deposit payment" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  // Check permissions
  if (user?.role === "GUEST") {
    throw new Response("Unauthorized", { status: 403 });
  }

  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  const depositId = url.searchParams.get("depositId");
  const amount = url.searchParams.get("amount");
  const returnTo = url.searchParams.get("returnTo");

  if (!bookingId || !depositId) {
    throw new Response("Booking ID and Deposit ID are required", { status: 400 });
  }

  // Get the booking and security deposit
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
        },
      },
      securityDeposit: true,
    },
  });

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  if (!booking.securityDeposit || booking.securityDeposit.id !== depositId) {
    throw new Response("Security deposit not found", { status: 404 });
  }

  // Get available payment accounts
  const paymentAccounts = await db.paymentAccount.findMany({
    where: { isActive: true },
    orderBy: { accountName: "asc" },
  });

  return json({ 
    booking, 
    user, 
    paymentAccounts, 
    defaultAmount: amount ? parseFloat(amount) : booking.securityDeposit.amount,
    returnTo 
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  // Check permissions
  if (user?.role === "GUEST") {
    throw new Response("Unauthorized", { status: 403 });
  }

  const formData = await request.formData();
  const bookingId = formData.get("bookingId") as string;
  const depositId = formData.get("depositId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const method = formData.get("method") as string;
  const accountId = formData.get("accountId") as string;
  const transactionId = formData.get("transactionId") as string;
  const notes = formData.get("notes") as string;
  const returnTo = formData.get("returnTo") as string;

  try {
    // Validate inputs
    if (!bookingId || !depositId || !amount || !method || !accountId) {
      return json(
        { error: "All required fields must be filled" },
        { status: 400 }
      );
    }

    // Get the booking and security deposit
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        room: true,
        securityDeposit: true,
      },
    });

    if (!booking || !booking.securityDeposit || booking.securityDeposit.id !== depositId) {
      return json(
        { error: "Booking or security deposit not found" },
        { status: 404 }
      );
    }

    if (booking.securityDeposit.status !== "PENDING") {
      return json(
        { error: "Security deposit has already been processed" },
        { status: 400 }
      );
    }

    // Update the security deposit
    const updatedDeposit = await db.securityDeposit.update({
      where: { id: depositId },
      data: {
        status: "PAID",
        method: method as "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "ONLINE" | "BANK_TRANSFER" | "MOBILE_MONEY",
        transactionId: transactionId || undefined,
        paidAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create transaction record
    await db.transaction.create({
      data: {
        transactionNumber: `SD-${Date.now()}-${depositId.slice(-4)}`,
        userId: booking.userId,
        type: "DEPOSIT",
        amount: amount,
        netAmount: amount, // Assuming no fees for security deposits
        method: method as "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "ONLINE" | "BANK_TRANSFER" | "MOBILE_MONEY",
        description: `Security deposit payment for Booking ${booking.id}`,
        reference: transactionId || `SD-${depositId.slice(-8)}`,
        paymentAccountId: accountId,
        metadata: JSON.stringify({
          bookingId,
          depositId,
          roomNumber: booking.room.number,
          notes: notes || null,
        }),
      },
    });

    // Send notifications
    try {
      // Send SMS to guest if phone number exists
      if (booking.user.phone) {
        await mnotifyService.sendSMS({
          recipient: booking.user.phone,
          message: `Security deposit received! GH₵${amount.toFixed(2)} for Booking ${booking.id.slice(-8)} at ${booking.room.type} ${booking.room.number}. Thank you!`,
        });
      }

      // Send SMS to admin if configured
      if (process.env.ADMIN_PHONE_NUMBER) {
        await mnotifyService.sendSMS({
          recipient: process.env.ADMIN_PHONE_NUMBER,
          message: `Security Deposit Alert: GH₵${amount.toFixed(2)} received for Booking ${booking.id.slice(-8)} (${booking.user.firstName} ${booking.user.lastName}). Room: ${booking.room.type} ${booking.room.number}`,
        });
      }
    } catch (notificationError) {
      console.error("SMS sending failed:", notificationError);
      // Don't fail the deposit recording if SMS fails
    }

    // Redirect to return URL or booking detail page with success message
    const redirectUrl = returnTo || `/dashboard/bookings/${bookingId}`;
    const successParams = new URLSearchParams({
      success: "security-deposit-received",
      depositId: updatedDeposit.id,
      ...(booking.user.phone && { guestNotified: "true" }),
      ...(process.env.ADMIN_PHONE_NUMBER && { adminNotified: "true" })
    });
    return redirect(`${redirectUrl}?${successParams.toString()}`);

  } catch (error) {
    console.error("Error recording security deposit:", error);
    return json(
      { error: "Failed to record security deposit. Please try again." },
      { status: 500 }
    );
  }
}

export default function ReceiveSecurityDeposit() {
  const { booking, user, paymentAccounts, defaultAmount, returnTo } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      amount: defaultAmount,
      method: "",
      accountId: "",
      transactionId: "",
      notes: "",
    },
    validate: {
      amount: (value) => (value <= 0 ? "Amount must be greater than 0" : null),
      method: (value) => (!value ? "Payment method is required" : null),
      accountId: (value) => (!value ? "Payment account is required" : null),
    },
  });

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Bookings", href: "/dashboard/bookings" },
    { title: `Booking #${booking.id.slice(-8)}`, href: `/dashboard/bookings/${booking.id}` },
    { title: "Receive Security Deposit", href: "#" },
  ].map((item, index) => (
    <Anchor 
      key={index} 
      href={item.href} 
      c={index === 3 ? "dimmed" : "blue"}
      onClick={(e) => {
        if (index === 3) e.preventDefault();
      }}
    >
      {item.title}
    </Anchor>
  ));

  const handleSubmit = () => {
    setIsSubmitting(true);
    // Form submission is handled by Remix
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Breadcrumbs separator=">">{breadcrumbItems}</Breadcrumbs>
            <Title order={2} mt="xs">
              Receive Security Deposit
            </Title>
          </div>
          <Button
            component="a"
            href={returnTo || `/dashboard/bookings/${booking.id}`}
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Booking
          </Button>
        </Group>

        {actionData?.error && (
          <Notification
            icon={<IconX size={18} />}
            color="red"
            title="Error"
            onClose={() => {}}
          >
            {actionData.error}
          </Notification>
        )}

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Text size="lg" fw={600}>Security Deposit Payment</Text>
                  <IconCreditCard size={24} />
                </Group>

                <Paper bg="gray.0" p="md" radius="sm">
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Guest</Text>
                      <Text fw={500}>{booking.user.firstName} {booking.user.lastName}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Room</Text>
                      <Text fw={500}>{booking.room.type} {booking.room.number}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Booking ID</Text>
                      <Text fw={500}>{booking.id}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Required Deposit</Text>
                      <Text fw={500} size="lg" c="blue">GH₵ {booking.securityDeposit!.amount.toFixed(2)}</Text>
                    </Grid.Col>
                  </Grid>
                </Paper>

                <form 
                  method="post" 
                  onSubmit={form.onSubmit(handleSubmit)}
                >
                  <Box pos="relative">
                    <LoadingOverlay visible={isSubmitting} />
                  
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="depositId" value={booking.securityDeposit!.id} />
                  <input type="hidden" name="returnTo" value={returnTo || ""} />

                  <Stack gap="md">
                    <NumberInput
                      label="Payment Amount"
                      placeholder="Enter amount received"
                      prefix="GH₵ "
                      decimalScale={2}
                      required
                      {...form.getInputProps("amount")}
                      name="amount"
                    />

                    <Select
                      label="Payment Method"
                      placeholder="Select payment method"
                      required
                      data={[
                        { value: "CASH", label: "Cash" },
                        { value: "BANK_TRANSFER", label: "Bank Transfer" },
                        { value: "MOBILE_MONEY", label: "Mobile Money" },
                        { value: "CREDIT_CARD", label: "Credit Card" },
                        { value: "DEBIT_CARD", label: "Debit Card" },
                        { value: "ONLINE", label: "Online Payment" },
                      ]}
                      {...form.getInputProps("method")}
                      name="method"
                    />

                    <Select
                      label="Payment Account"
                      placeholder="Select account where payment was received"
                      required
                      data={paymentAccounts.map(account => ({
                        value: account.id,
                        label: `${account.accountName || account.id} (${account.type})`
                      }))}
                      {...form.getInputProps("accountId")}
                      name="accountId"
                    />

                    <TextInput
                      label="Transaction ID / Reference"
                      placeholder="Enter transaction reference (optional)"
                      {...form.getInputProps("transactionId")}
                      name="transactionId"
                    />

                    <TextInput
                      label="Notes"
                      placeholder="Additional notes (optional)"
                      {...form.getInputProps("notes")}
                      name="notes"
                    />

                    <Group justify="flex-end" gap="sm">
                      <Button
                        type="button"
                        variant="light"
                        onClick={() => window.history.back()}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        leftSection={<IconCheck size={16} />}
                        loading={isSubmitting}
                      >
                        Record Security Deposit
                      </Button>
                    </Group>
                  </Stack>
                  </Box>
                </form>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder>
              <Stack gap="md">
                <Text size="lg" fw={600}>Payment Summary</Text>
                
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Security Deposit Amount</Text>
                    <Text fw={500}>GH₵ {booking.securityDeposit!.amount.toFixed(2)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Amount to Receive</Text>
                    <Text fw={500} size="lg" c="blue">GH₵ {form.values.amount.toFixed(2)}</Text>
                  </Group>
                </Stack>

                <Paper bg="blue.0" p="sm" radius="sm">
                  <Text size="xs" c="blue.7">
                    💡 The security deposit will be held and can be refunded after checkout, minus any deductions for damages or extra charges.
                  </Text>
                </Paper>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </DashboardLayout>
  );
}
