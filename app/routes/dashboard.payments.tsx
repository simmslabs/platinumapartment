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
  Alert,
  Text,
  Card,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconInfoCircle } from "@tabler/icons-react";
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

  const payments = await db.payment.findMany({
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
                    <Text fw={500}>${payment.amount}</Text>
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
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
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
                  label: `${booking.user.firstName} ${booking.user.lastName} - Room ${booking.room.number} ($${booking.totalAmount})`
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
