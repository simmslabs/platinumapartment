import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSearchParams } from "@remix-run/react";
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
  Alert,
  Text,
  Card,
  TextInput,
  ActionIcon,
  Grid,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconInfoCircle, IconTrash, IconFilter, IconX, IconSearch } from "@tabler/icons-react";
import { format } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Payment, Booking, User, Room } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Payments - Apartment Management" },
    { name: "description", content: "Manage apartment payments" },
  ];
};

type PaymentWithDetails = Payment & {
  booking: Booking & {
    user: Pick<User, "firstName" | "lastName" | "email">;
    room: Pick<Room, "number">;
  };
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const method = url.searchParams.get("method");
  const search = url.searchParams.get("search");

  // Build where clause for filtering
  const where: any = {};
  
  if (status && status !== "all") {
    where.status = status;
  }
  
  if (method && method !== "all") {
    where.method = method;
  }

  if (search) {
    where.OR = [
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
    where,
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

  return json({ user, payments, unpaidBookings });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const bookingId = formData.get("bookingId") as string;
      const method = formData.get("method") as any;
      const transactionId = formData.get("transactionId") as string;

      if (!bookingId || !method) {
        return json({ error: "Booking and payment method are required" }, { status: 400 });
      }

      // Get booking to get the amount
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }

      await db.payment.create({
        data: {
          bookingId,
          amount: booking.totalAmount,
          method,
          status: "COMPLETED",
          transactionId: transactionId || null,
          paidAt: new Date(),
        },
      });

      return json({ success: "Payment recorded successfully" });
    }

    if (intent === "delete") {
      const paymentId = formData.get("paymentId") as string;

      if (!paymentId) {
        return json({ error: "Payment ID is required" }, { status: 400 });
      }

      await db.payment.delete({
        where: { id: paymentId },
      });

      return json({ success: "Payment deleted successfully" });
    }

    if (intent === "update-status") {
      const paymentId = formData.get("paymentId") as string;
      const status = formData.get("status") as any;

      await db.payment.update({
        where: { id: paymentId },
        data: { 
          status,
          paidAt: status === "COMPLETED" ? new Date() : null,
        },
      });

      return json({ success: "Payment status updated successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Payment action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Payments() {
  const { user, payments, unpaidBookings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchParams, setSearchParams] = useSearchParams();

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

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Payments Management</Title>
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
              Don't forget to collect security deposits for new bookings. 
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

        {actionData?.error && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData?.success && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
          >
            {actionData.success}
          </Alert>
        )}

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
          
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                placeholder="Search guest, email, or transaction ID"
                leftSection={<IconSearch size={16} />}
                value={searchParams.get("search") || ""}
                onChange={(event) => handleFilter("search", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Flex justify="flex-end" align="center" h="100%">
                <Text size="sm" c="dimmed">
                  {payments.length} payment{payments.length !== 1 ? 's' : ''} found
                </Text>
              </Flex>
            </Grid.Col>
          </Grid>
        </Card>

        <Card>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guest</Table.Th>
                <Table.Th>Room</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Method</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Transaction ID</Table.Th>
                <Table.Th>Paid Date</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {payments.map((payment) => (
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

          {payments.length === 0 && (
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
              <Select
                label="Booking"
                placeholder="Select booking"
                name="bookingId"
                data={unpaidBookings.map(booking => ({
                  value: booking.id,
                  label: `${booking.user.firstName} ${booking.user.lastName} - Room ${booking.room.number} (₵${booking.totalAmount})`
                }))}
                required
                searchable
              />

              <Select
                label="Payment Method"
                placeholder="Select method"
                name="method"
                data={[
                  { value: "CASH", label: "Cash" },
                  { value: "CREDIT_CARD", label: "Credit Card" },
                  { value: "DEBIT_CARD", label: "Debit Card" },
                  { value: "ONLINE", label: "Online Payment" },
                  { value: "BANK_TRANSFER", label: "Bank Transfer" },
                ]}
                required
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
