import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSearchParams, Outlet, useLocation } from "@remix-run/react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  Select,
  Alert,
  Text,
  Card,
  TextInput,
  ActionIcon,
  Flex,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Progress,
  RingProgress,
  Center,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconInfoCircle, IconTrash, IconFilter, IconX, IconSearch, IconTrendingUp, IconCreditCard, IconCurrencyDollar, IconChartBar, IconChartPie, IconCash, IconCashBanknote, IconReceipt } from "@tabler/icons-react";
import { format } from "date-fns";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Payment } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Payments - Apartment Management" },
    { name: "description", content: "Manage apartment payments and transactions" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const method = url.searchParams.get("method");
  const search = url.searchParams.get("search");
  const bookingId = url.searchParams.get("bookingId"); // Get bookingId from URL

  // Build where clause for filtering
  const whereClause: {
    status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
    method?: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "MOBILE_MONEY" | "BANK_TRANSFER" | "ONLINE";
    OR?: Array<{
      booking?: {
        user?: {
          OR?: Array<{
            firstName?: { contains: string; mode: "insensitive" };
            lastName?: { contains: string; mode: "insensitive" };
            email?: { contains: string; mode: "insensitive" };
          }>;
        };
      };
      transactionId?: { contains: string; mode: "insensitive" };
    }>;
  } = {};
  
  if (status && status !== "all") {
    whereClause.status = status as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  }
  
  if (method && method !== "all") {
    whereClause.method = method as "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "MOBILE_MONEY" | "BANK_TRANSFER" | "ONLINE";
  }

  if (search) {
    whereClause.OR = [
      {
        booking: {
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        transactionId: { contains: search, mode: "insensitive" },
      },
    ];
  }

  const payments = await db.payment.findMany({
    where: whereClause,
    include: {
      booking: {
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
          room: {
            select: { number: true },
          },
        },
      },
      paymentAccount: true,
      receipt: true,
      transactions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get bookings without payments
  const unpaidBookings = await db.booking.findMany({
    where: {
      payment: null,
      status: { not: "CANCELLED" },
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
      room: {
        select: { number: true },
      },
    },
  });

  // If bookingId is provided, also include all bookings for the dropdown
  // so user can see the selected booking even if it has payment
  let allBookingsForDropdown = unpaidBookings;
  if (bookingId) {
    const allBookings = await db.booking.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        room: {
          select: { number: true },
        },
        payment: true,
      },
    });
    allBookingsForDropdown = allBookings;
  }

  // Get payment accounts for payment method selection
  const paymentAccounts = await db.paymentAccount.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Get specific booking details if bookingId is provided
  let selectedBooking = null;
  if (bookingId) {
    selectedBooking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        room: {
          select: { number: true },
        },
        payment: true,
      },
    });
  }

  return json({ user, payments, unpaidBookings, paymentAccounts, selectedBooking, bookingId, allBookingsForDropdown });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const bookingId = formData.get("bookingId") as string;
      const paymentAccountId = formData.get("paymentAccountId") as string;
      const transactionId = formData.get("transactionId") as string;
      const notes = formData.get("notes") as string;

      if (!bookingId || !paymentAccountId) {
        return json({ error: "Booking and payment account are required" }, { status: 400 });
      }

      // Get booking to get the amount and check for existing payment
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: {
          payment: true,
        },
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }

      // Check if booking already has a completed payment
      if (booking.payment && booking.payment.status === "COMPLETED") {
        return json({ error: "This booking already has a completed payment" }, { status: 400 });
      }

      // Get payment account
      const paymentAccount = await db.paymentAccount.findUnique({
        where: { id: paymentAccountId },
      });

      if (!paymentAccount) {
        return json({ error: "Payment account not found" }, { status: 400 });
      }

      // Create payment with receipt
      const payment = await db.payment.create({
        data: {
          bookingId,
          amount: booking.totalAmount,
          method: paymentAccount.type === "CREDIT_CARD" ? "CREDIT_CARD" : 
                  paymentAccount.type === "DEBIT_CARD" ? "DEBIT_CARD" :
                  paymentAccount.type === "MOBILE_WALLET" ? "MOBILE_MONEY" : "BANK_TRANSFER",
          status: "COMPLETED",
          transactionId: transactionId || `TXN-${Date.now()}`,
          paymentAccountId,
          notes,
        },
      });

      // Create receipt
      await db.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber: `RCP-${Date.now()}`,
          userId: booking.userId,
          amount: booking.totalAmount,
          totalAmount: booking.totalAmount,
          description: `Payment for Room ${booking.roomId} booking`,
          items: JSON.stringify([{
            name: `Room booking`,
            quantity: 1,
            price: booking.totalAmount,
            total: booking.totalAmount
          }]),
        },
      });

      // Create transaction record
      await db.transaction.create({
        data: {
          paymentId: payment.id,
          transactionNumber: `TXN-${Date.now()}`,
          userId: booking.userId,
          amount: booking.totalAmount,
          netAmount: booking.totalAmount,
          type: "PAYMENT",
          status: "COMPLETED",
          method: payment.method,
          paymentAccountId,
          reference: payment.transactionId,
          description: `Payment for booking ${booking.id}`,
        },
      });

      // Auto-update booking status to CONFIRMED when payment is completed
      await db.booking.update({
        where: { id: bookingId },
        data: { status: "CONFIRMED" },
      });

      return json({ success: "Payment recorded successfully" });
    }

    if (intent === "delete") {
      const paymentId = formData.get("paymentId") as string;

      if (!paymentId) {
        return json({ error: "Payment ID is required" }, { status: 400 });
      }

      // Get the payment to find the associated booking
      const payment = await db.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        return json({ error: "Payment not found" }, { status: 400 });
      }

      // Delete the payment
      await db.payment.delete({
        where: { id: paymentId },
      });

      // Update booking status back to PENDING since payment was deleted
      await db.booking.update({
        where: { id: payment.bookingId },
        data: { status: "PENDING" },
      });

      return json({ success: "Payment deleted successfully" });
    }

    if (intent === "update-status") {
      const paymentId = formData.get("paymentId") as string;
      const status = formData.get("status") as "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

      // Get the payment to find the associated booking
      const payment = await db.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        return json({ error: "Payment not found" }, { status: 400 });
      }

      // Update payment status
      await db.payment.update({
        where: { id: paymentId },
        data: { 
          status,
          paidAt: status === "COMPLETED" ? new Date() : null,
        },
      });

      // Update booking status based on payment status
      let bookingStatus: "PENDING" | "CONFIRMED" = "PENDING"; // Default for unpaid/failed payments
      if (status === "COMPLETED") {
        bookingStatus = "CONFIRMED";
      } else if (status === "FAILED" || status === "REFUNDED") {
        bookingStatus = "PENDING"; // Reset to pending if payment failed or refunded
      }

      await db.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingStatus },
      });

      return json({ success: "Payment status updated successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Payment action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Payments() {
  const { user, payments, unpaidBookings, paymentAccounts, selectedBooking, bookingId, allBookingsForDropdown } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(!!bookingId); // Auto-open if bookingId is provided
  const [searchParams, setSearchParams] = useSearchParams();

  const location = useLocation();

  // Type assertion to fix the TypeScript inference issue
  const typedPayments = payments as unknown as Array<{
    id: string;
    status: Payment["status"];
    method: Payment["method"];
    amount: number;
    transactionId: string | null;
    paidAt: Date | null;
    booking: {
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
      room: {
        number: string;
      };
    };
    paymentAccount?: {
      accountName: string | null;
      type: string;
      provider: string;
    } | null;
  }>;

  const getStatusColor = (status: Payment["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "green";
      case "PENDING":
        return "yellow";
      case "FAILED":
        return "red";
      case "REFUNDED":
        return "gray";
      default:
        return "gray";
    }
  };

  const getMethodColor = (method: Payment["method"]) => {
    switch (method) {
      case "CASH":
        return "green";
      case "CREDIT_CARD":
        return "blue";
      case "DEBIT_CARD":
        return "cyan";
      case "ONLINE":
        return "violet";
      case "BANK_TRANSFER":
        return "orange";
      default:
        return "gray";
    }
  };

  // Analytics calculations
  const totalRevenue = typedPayments
    .filter(p => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = typedPayments
    .filter(p => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amount, 0);

  const completedPayments = typedPayments.filter(p => p.status === "COMPLETED").length;
  const pendingPayments = typedPayments.filter(p => p.status === "PENDING").length;
  const failedPayments = typedPayments.filter(p => p.status === "FAILED").length;

  const paymentMethods = typedPayments.reduce((acc, payment) => {
    acc[payment.method] = (acc[payment.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const methodStats = [
    { method: "CASH", count: paymentMethods.CASH || 0, color: "green" },
    { method: "CREDIT_CARD", count: paymentMethods.CREDIT_CARD || 0, color: "blue" },
    { method: "DEBIT_CARD", count: paymentMethods.DEBIT_CARD || 0, color: "cyan" },
    { method: "MOBILE_MONEY", count: paymentMethods.MOBILE_MONEY || 0, color: "violet" },
    { method: "BANK_TRANSFER", count: paymentMethods.BANK_TRANSFER || 0, color: "orange" },
  ];

  const totalPayments = typedPayments.length;
  const completionRate = totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0;

  const handleFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const handleDelete = (paymentId: string) => {
    if (confirm("Are you sure you want to delete this payment? This action cannot be undone.")) {
      const form = new FormData();
      form.append("intent", "delete");
      form.append("paymentId", paymentId);
      fetch("/dashboard/payments", {
        method: "POST",
        body: form,
      }).then(() => window.location.reload());
    }
  };

  if(location.pathname !== "/dashboard/payments") return <Outlet />

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={2}>Payments Management</Title>
            {selectedBooking && (
              <Text size="sm" c="dimmed">
                Processing payment for {selectedBooking.user.firstName} {selectedBooking.user.lastName} - Room {selectedBooking.room.number}
              </Text>
            )}
          </div>
          {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && unpaidBookings.length > 0 && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Record Payment
            </Button>
          )}
        </Group>

        {/* Security Deposit Integration */}
        {unpaidBookings.length > 0 && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Security Deposits Reminder"
            color="blue"
            variant="light"
          >
            <Text size="sm" mb="xs">
              Don&apos;t forget to collect security deposits for new bookings. 
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

        {/* Analytics Dashboard */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="sm" fw={500}>
                  Total Revenue
                </Text>
                <Text fw={700} size="xl">
                  ₵{totalRevenue.toFixed(2)}
                </Text>
              </div>
              <ThemeIcon color="green" size={60} radius="md" variant="light">
                <IconCurrencyDollar size={30} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="sm" fw={500}>
                  Pending Amount
                </Text>
                <Text fw={700} size="xl">
                  ₵{pendingAmount.toFixed(2)}
                </Text>
              </div>
              <ThemeIcon color="yellow" size={60} radius="md" variant="light">
                <IconTrendingUp size={30} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="sm" fw={500}>
                  Completed Payments
                </Text>
                <Text fw={700} size="xl">
                  {completedPayments}
                </Text>
              </div>
              <ThemeIcon color="blue" size={60} radius="md" variant="light">
                <IconReceipt size={30} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="sm" fw={500}>
                  Completion Rate
                </Text>
                <Text fw={700} size="xl">
                  {completionRate.toFixed(1)}%
                </Text>
              </div>
              <ThemeIcon color="teal" size={60} radius="md" variant="light">
                <IconChartBar size={30} />
              </ThemeIcon>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Payment Method Distribution and Status Charts */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Group mb="md">
              <IconChartPie size={20} />
              <Text fw={600}>Payment Methods</Text>
            </Group>
            <Stack gap="sm">
              {methodStats.map((stat) => (
                <Group key={stat.method} justify="space-between">
                  <Group>
                    <ThemeIcon color={stat.color} size="sm" variant="light">
                      {stat.method === "CASH" ? <IconCash size={14} /> :
                       stat.method === "CREDIT_CARD" ? <IconCreditCard size={14} /> :
                       stat.method === "BANK_TRANSFER" ? <IconCashBanknote size={14} /> :
                       <IconCreditCard size={14} />}
                    </ThemeIcon>
                    <Text size="sm" fw={500}>
                      {stat.method.replace('_', ' ')}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Badge color={stat.color} variant="light" size="sm">
                      {stat.count}
                    </Badge>
                    <Progress
                      value={totalPayments > 0 ? (stat.count / totalPayments) * 100 : 0}
                      color={stat.color}
                      size="sm"
                      w={80}
                    />
                  </Group>
                </Group>
              ))}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group mb="md">
              <IconChartBar size={20} />
              <Text fw={600}>Payment Status Overview</Text>
            </Group>
            <Stack gap="md">
              <Center>
                <RingProgress
                  size={180}
                  thickness={16}
                  sections={[
                    { value: totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0, color: 'green', tooltip: `Completed: ${completedPayments}` },
                    { value: totalPayments > 0 ? (pendingPayments / totalPayments) * 100 : 0, color: 'yellow', tooltip: `Pending: ${pendingPayments}` },
                    { value: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0, color: 'red', tooltip: `Failed: ${failedPayments}` },
                  ]}
                  label={
                    <Center>
                      <div>
                        <Text ta="center" fw={700} size="xl">
                          {totalPayments}
                        </Text>
                        <Text ta="center" c="dimmed" size="sm">
                          Total Payments
                        </Text>
                      </div>
                    </Center>
                  }
                />
              </Center>
              <SimpleGrid cols={3}>
                <div>
                  <Text ta="center" size="sm" c="dimmed">Completed</Text>
                  <Text ta="center" fw={700} c="green">{completedPayments}</Text>
                </div>
                <div>
                  <Text ta="center" size="sm" c="dimmed">Pending</Text>
                  <Text ta="center" fw={700} c="yellow">{pendingPayments}</Text>
                </div>
                <div>
                  <Text ta="center" size="sm" c="dimmed">Failed</Text>
                  <Text ta="center" fw={700} c="red">{failedPayments}</Text>
                </div>
              </SimpleGrid>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Filters */}
        <Card>
          <Group mb="md">
            <IconFilter size={16} />
            <Text fw={500}>Filters</Text>
            {(searchParams.get("status") || searchParams.get("method") || searchParams.get("search")) && (
              <Button
                variant="light"
                size="xs"
                leftSection={<IconX size={12} />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </Group>
          
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <TextInput
              placeholder="Search guest, email, or transaction ID"
              leftSection={<IconSearch size={16} />}
              value={searchParams.get("search") || ""}
              onChange={(event) => handleFilter("search", event.currentTarget.value)}
            />
            <Select
              placeholder="Filter by status"
              value={searchParams.get("status") || "all"}
              onChange={(value) => handleFilter("status", value || "")}
              data={[
                { value: "all", label: "All Statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "COMPLETED", label: "Completed" },
                { value: "FAILED", label: "Failed" },
                { value: "REFUNDED", label: "Refunded" },
              ]}
            />
            <Select
              placeholder="Filter by method"
              value={searchParams.get("method") || "all"}
              onChange={(value) => handleFilter("method", value || "")}
              data={[
                { value: "all", label: "All Methods" },
                { value: "CASH", label: "Cash" },
                { value: "CREDIT_CARD", label: "Credit Card" },
                { value: "DEBIT_CARD", label: "Debit Card" },
                { value: "ONLINE", label: "Online Payment" },
                { value: "BANK_TRANSFER", label: "Bank Transfer" },
              ]}
            />
            <Flex justify="flex-end" align="center" h="100%">
              <Text size="sm" c="dimmed">
                {typedPayments.length} payment{typedPayments.length !== 1 ? 's' : ''} found
              </Text>
            </Flex>
          </SimpleGrid>
        </Card>

        <Card>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Room</Table.Th>
                  <Table.Th>Amount</Table.Th>
                <Table.Th>Method</Table.Th>
                <Table.Th>Payment Account</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Transaction ID</Table.Th>
                <Table.Th>Paid Date</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {typedPayments.map((payment) => (
                <Table.Tr key={payment.id}>
                  <Table.Td>
                    <div>
                      <Text fw={500}>
                        {payment.booking.user.firstName} {payment.booking.user.lastName}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {payment.booking.user.email}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>Room {payment.booking.room.number}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>₵{payment.amount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getMethodColor(payment.method)} size="sm">
                      {payment.method.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {payment.paymentAccount ? (
                      <div>
                        <Text size="sm" fw={500}>
                          {payment.paymentAccount.accountName || `${payment.paymentAccount.type} Account`}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {payment.paymentAccount.provider}
                        </Text>
                      </div>
                    ) : (
                      <Text size="sm" c="dimmed">Legacy Payment</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(payment.status)} size="sm">
                      {payment.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {payment.transactionId || "N/A"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {payment.paidAt
                      ? format(new Date(payment.paidAt), "MMM dd, yyyy")
                      : "N/A"
                    }
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                        <Form method="post" style={{ display: "inline" }}>
                          <input type="hidden" name="intent" value="update-status" />
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <Select
                            name="status"
                            size="xs"
                            data={[
                              { value: "PENDING", label: "Pending" },
                              { value: "COMPLETED", label: "Completed" },
                              { value: "FAILED", label: "Failed" },
                              { value: "REFUNDED", label: "Refunded" },
                            ]}
                            defaultValue={payment.status}
                            onChange={(value) => {
                              if (value) {
                                const form = new FormData();
                                form.append("intent", "update-status");
                                form.append("paymentId", payment.id);
                                form.append("status", value);
                                fetch("/dashboard/payments", {
                                  method: "POST",
                                  body: form,
                                }).then(() => window.location.reload());
                              }
                            }}
                          />
                        </Form>
                      )}
                      {user?.role === "ADMIN" && (
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="sm"
                          onClick={() => handleDelete(payment.id)}
                          title="Delete payment"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>

          {typedPayments.length === 0 && (
            <Stack align="center" py="xl">
              <IconInfoCircle size={48} color="gray" />
              <Text c="dimmed" ta="center">
                {(searchParams.get("status") || searchParams.get("method") || searchParams.get("search"))
                  ? "No payments found matching your filters"
                  : "No payments recorded yet"
                }
              </Text>
            </Stack>
          )}
        </Card>

        <Modal opened={opened} onClose={close} title="Record Payment" size="lg">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Stack>
              {selectedBooking && (
                <Alert
                  title="Payment for Selected Booking"
                  color="blue"
                  variant="light"
                  mb="md"
                >
                  <Text size="sm">
                    <strong>Tenant:</strong> {selectedBooking.user.firstName} {selectedBooking.user.lastName}
                  </Text>
                  <Text size="sm">
                    <strong>Room:</strong> {selectedBooking.room.number}
                  </Text>
                  <Text size="sm">
                    <strong>Amount:</strong> ₵{selectedBooking.totalAmount}
                  </Text>
                  {selectedBooking.payment && (
                    <Text size="sm" c="red">
                      <strong>Note:</strong> This booking already has a payment recorded.
                    </Text>
                  )}
                </Alert>
              )}
              
              <Select
                label="Booking"
                placeholder="Select booking"
                name="bookingId"
                defaultValue={selectedBooking?.id}
                data={(allBookingsForDropdown || []).map(booking => ({
                  value: booking.id,
                  label: `${booking.user.firstName} ${booking.user.lastName} - Room ${booking.room.number} (₵${booking.totalAmount})${'payment' in booking && booking.payment ? ' [PAID]' : ''}`
                }))}
                required
                searchable
              />

              <Select
                label="Payment Account"
                placeholder="Select payment account"
                name="paymentAccountId"
                data={(paymentAccounts || []).map(account => ({
                  value: account.id,
                  label: `${account.accountName || `${account.type} Account`} (${account.type}) - ${account.provider}`
                }))}
                required
                searchable
              />

              <TextInput
                label="Transaction ID (Optional)"
                placeholder="External transaction reference"
                name="transactionId"
              />

              <TextInput
                label="Notes (Optional)"
                placeholder="Additional payment notes"
                name="notes"
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" onClick={close}>
                  Record Payment
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
