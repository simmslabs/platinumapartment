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
  Grid,
  Flex,
  Textarea,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { 
  IconPlus, 
  IconInfoCircle, 
  IconShield, 
  IconFilter, 
  IconX, 
  IconSearch, 
  IconCash,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
} from "@tabler/icons-react";
import { format } from "date-fns";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { SecurityDeposit, Booking, User, Room, PaymentMethod, SecurityDepositStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { useState, useEffect } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Security Deposits - Apartment Management" },
    { name: "description", content: "Manage security deposits and refunds" },
  ];
};

type SecurityDepositWithDetails = SecurityDeposit & {
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
  const search = url.searchParams.get("search");

  // Build where clause for filtering
  const where: Prisma.SecurityDepositWhereInput = {};
  
  if (status && status !== "all") {
    where.status = status as SecurityDepositStatus;
  }

  if (search) {
    where.OR = [
      {
        booking: {
          user: {
            OR: [
              { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          },
        },
      },
      {
        transactionId: { contains: search, mode: Prisma.QueryMode.insensitive },
      },
    ];
  }

  const securityDeposits = await db.securityDeposit.findMany({
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

  // Get bookings that need security deposits (confirmed but not paid)
  const pendingDeposits = await db.booking.findMany({
    where: {
      securityDeposit: null,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
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

  // Get active payment accounts for the dropdown
  const paymentAccounts = await db.paymentAccount.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return json({ 
    user, 
    securityDeposits, 
    pendingDeposits,
    paymentAccounts
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "collect") {
      const bookingId = formData.get("bookingId") as string;
      const amount = parseFloat(formData.get("amount") as string);
      const paymentAccountId = formData.get("paymentAccountId") as string;
      const transactionId = formData.get("transactionId") as string;

      if (!bookingId || !amount || !paymentAccountId) {
        return json({ error: "Booking, amount, and payment account are required" }, { status: 400 });
      }

      let method: PaymentMethod = "CASH"; // Default for cash payments

      // Handle cash payments differently
      if (paymentAccountId !== "cash") {
        // Get the payment account to determine the method
        const paymentAccount = await db.paymentAccount.findUnique({
          where: { id: paymentAccountId },
        });

        if (!paymentAccount) {
          return json({ error: "Payment account not found" }, { status: 400 });
        }

        // Map payment account type to method for backward compatibility
        const methodMapping: Record<string, PaymentMethod> = {
          CREDIT_CARD: "CREDIT_CARD",
          DEBIT_CARD: "DEBIT_CARD", 
          BANK_ACCOUNT: "BANK_TRANSFER",
          MOBILE_WALLET: "MOBILE_MONEY",
          DIGITAL_WALLET: "MOBILE_MONEY",
          CRYPTO_WALLET: "BANK_TRANSFER"
        };

        method = (methodMapping[paymentAccount.type] || "CASH") as PaymentMethod;
      }

      await db.securityDeposit.create({
        data: {
          bookingId,
          amount,
          method,
          status: "PAID",
          transactionId: transactionId || null,
          paidAt: new Date(),
        },
      });

      return json({ success: "Security deposit collected successfully" });
    }

    if (intent === "refund") {
      const depositId = formData.get("depositId") as string;
      const refundAmount = parseFloat(formData.get("refundAmount") as string);
      const deductionAmount = parseFloat(formData.get("deductionAmount") as string) || 0;
      const deductionReason = formData.get("deductionReason") as string;
      const damageReport = formData.get("damageReport") as string;

      if (!depositId || !refundAmount) {
        return json({ error: "Deposit ID and refund amount are required" }, { status: 400 });
      }

      const deposit = await db.securityDeposit.findUnique({
        where: { id: depositId },
      });

      if (!deposit) {
        return json({ error: "Security deposit not found" }, { status: 400 });
      }

      if (refundAmount + deductionAmount !== deposit.amount) {
        return json({ error: "Refund amount plus deduction must equal original deposit" }, { status: 400 });
      }

      const status = deductionAmount > 0 
        ? (refundAmount > 0 ? "PARTIALLY_REFUNDED" : "FORFEITED")
        : "REFUNDED";

      await db.securityDeposit.update({
        where: { id: depositId },
        data: {
          status,
          refundedAt: new Date(),
          refundAmount,
          deductionAmount,
          deductionReason: deductionAmount > 0 ? deductionReason : null,
          damageReport: deductionAmount > 0 ? damageReport : null,
          processedBy: user?.id,
        },
      });

      return json({ success: "Security deposit processed successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Security deposit action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function SecurityDeposits() {
  const { user, securityDeposits, pendingDeposits, paymentAccounts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [collectOpened, { open: openCollect, close: closeCollect }] = useDisclosure(false);
  const [refundOpened, { open: openRefund, close: closeRefund }] = useDisclosure(false);
  const [selectedDeposit, setSelectedDeposit] = useState<SecurityDepositWithDetails | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Refund form state
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>("");
  const [damageReport, setDamageReport] = useState<string>("");

  // Auto-calculate refund amount when deduction amount changes
  useEffect(() => {
    if (selectedDeposit && deductionAmount >= 0) {
      const calculatedRefund = selectedDeposit.amount - deductionAmount;
      setRefundAmount(Math.max(0, calculatedRefund));
    }
  }, [deductionAmount, selectedDeposit]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (selectedDeposit && refundOpened) {
      setDeductionAmount(0);
      setRefundAmount(selectedDeposit.amount);
      setDeductionReason("");
      setDamageReport("");
    }
  }, [selectedDeposit, refundOpened]);

  // Validation function
  const isValidRefundForm = () => {
    if (!selectedDeposit) return false;
    if (refundAmount + deductionAmount !== selectedDeposit.amount) return false;
    if (deductionAmount > 0 && !deductionReason.trim()) return false;
    return true;
  };

  const getStatusColor = (status: SecurityDeposit["status"]) => {
    switch (status) {
      case "PAID":
        return "blue";
      case "REFUNDED":
        return "green";
      case "PARTIALLY_REFUNDED":
        return "yellow";
      case "FORFEITED":
        return "red";
      case "PENDING":
        return "orange";
      default:
        return "gray";
    }
  };

  const getMethodColor = (method: SecurityDeposit["method"]) => {
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

  const openRefundModal = (deposit: typeof securityDeposits[0]) => {
    // Convert serialized dates back to Date objects for state management
    const convertedDeposit: SecurityDepositWithDetails = {
      ...deposit,
      createdAt: deposit.createdAt ? new Date(deposit.createdAt) : new Date(),
      updatedAt: deposit.updatedAt ? new Date(deposit.updatedAt) : new Date(),
      paidAt: deposit.paidAt ? new Date(deposit.paidAt) : null,
      refundedAt: deposit.refundedAt ? new Date(deposit.refundedAt) : null,
      booking: {
        ...deposit.booking,
        createdAt: deposit.booking.createdAt ? new Date(deposit.booking.createdAt) : new Date(),
        updatedAt: deposit.booking.updatedAt ? new Date(deposit.booking.updatedAt) : new Date(),
        checkIn: deposit.booking.checkIn ? new Date(deposit.booking.checkIn) : new Date(),
        checkOut: deposit.booking.checkOut ? new Date(deposit.booking.checkOut) : new Date(),
        deletedAt: deposit.booking.deletedAt ? new Date(deposit.booking.deletedAt) : null,
      },
    };
    setSelectedDeposit(convertedDeposit);
    openRefund();
  };

  const calculateTotalStats = () => {
    const totalCollected = securityDeposits
      .filter(d => d.status === "PAID")
      .reduce((sum, d) => sum + d.amount, 0);
    
    const totalRefunded = securityDeposits
      .filter(d => ["REFUNDED", "PARTIALLY_REFUNDED"].includes(d.status))
      .reduce((sum, d) => sum + (d.refundAmount || 0), 0);
    
    const totalForfeited = securityDeposits
      .filter(d => ["PARTIALLY_REFUNDED", "FORFEITED"].includes(d.status))
      .reduce((sum, d) => sum + (d.deductionAmount || 0), 0);

    return { totalCollected, totalRefunded, totalForfeited };
  };

  const stats = calculateTotalStats();

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={2}>Security Deposits</Title>
            <Text c="dimmed" size="sm">
              Manage security deposits and process refunds after checkout
            </Text>
          </div>
          {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCollect}>
              Collect Deposit
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
            icon={<IconCheck size={16} />}
            title="Success"
            color="green"
          >
            {actionData.success}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card>
              <Group>
                <IconShield size={24} color="blue" />
                <div>
                  <Text c="dimmed" size="sm">Total Collected</Text>
                  <Text fw={700} size="lg">₵{stats.totalCollected}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card>
              <Group>
                <IconRefresh size={24} color="green" />
                <div>
                  <Text c="dimmed" size="sm">Total Refunded</Text>
                  <Text fw={700} size="lg">₵{stats.totalRefunded}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card>
              <Group>
                <IconAlertTriangle size={24} color="red" />
                <div>
                  <Text c="dimmed" size="sm">Total Forfeited</Text>
                  <Text fw={700} size="lg">₵{stats.totalForfeited}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card>
              <Group>
                <IconCash size={24} color="orange" />
                <div>
                  <Text c="dimmed" size="sm">Pending Collection</Text>
                  <Text fw={700} size="lg">{pendingDeposits.length}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Card>
          <Group mb="md">
            <IconFilter size={16} />
            <Text fw={500}>Filters</Text>
            {(searchParams.get("status") || searchParams.get("search")) && (
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
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                placeholder="Search guest, email, or transaction ID"
                leftSection={<IconSearch size={16} />}
                value={searchParams.get("search") || ""}
                onChange={(event) => handleFilter("search", event.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Filter by status"
                value={searchParams.get("status") || "all"}
                onChange={(value) => handleFilter("status", value || "")}
                data={[
                  { value: "all", label: "All Statuses" },
                  { value: "PENDING", label: "Pending" },
                  { value: "PAID", label: "Paid" },
                  { value: "REFUNDED", label: "Refunded" },
                  { value: "PARTIALLY_REFUNDED", label: "Partially Refunded" },
                  { value: "FORFEITED", label: "Forfeited" },
                ]}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 12, md: 4 }}>
              <Flex justify="flex-end" align="center" h="100%">
                <Text size="sm" c="dimmed">
                  {securityDeposits.length} deposit{securityDeposits.length !== 1 ? 's' : ''} found
                </Text>
              </Flex>
            </Grid.Col>
          </Grid>
        </Card>

        <Card>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Room</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Account</Table.Th>
                  <Table.Th>Status</Table.Th>
                <Table.Th>Paid Date</Table.Th>
                <Table.Th>Refund Info</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {securityDeposits.map((deposit) => (
                <Table.Tr key={deposit.id}>
                  <Table.Td>
                    <div>
                      <Text fw={500}>
                        {deposit.booking.user.firstName} {deposit.booking.user.lastName}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {deposit.booking.user.email}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>Room {deposit.booking.room.number}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>₵{deposit.amount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getMethodColor(deposit.method)} size="sm">
                      {deposit.method.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(deposit.status)} size="sm">
                      {deposit.status.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {deposit.paidAt
                      ? format(new Date(deposit.paidAt), "MMM dd, yyyy")
                      : "N/A"
                    }
                  </Table.Td>
                  <Table.Td>
                    {deposit.status === "REFUNDED" && (
                      <Text size="sm" c="green">
                        Refunded: ₵{deposit.refundAmount}
                      </Text>
                    )}
                    {deposit.status === "PARTIALLY_REFUNDED" && (
                      <div>
                        <Text size="sm" c="green">
                          Refunded: ₵{deposit.refundAmount}
                        </Text>
                        <Text size="sm" c="red">
                          Deducted: ₵{deposit.deductionAmount}
                        </Text>
                      </div>
                    )}
                    {deposit.status === "FORFEITED" && (
                      <Text size="sm" c="red">
                        Forfeited: ₵{deposit.amount}
                      </Text>
                    )}
                    {deposit.refundedAt && (
                      <Text size="xs" c="dimmed">
                        {format(new Date(deposit.refundedAt), "MMM dd, yyyy")}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {deposit.status === "PAID" && (user?.role === "ADMIN" || user?.role === "MANAGER") && (
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        onClick={() => openRefundModal(deposit)}
                      >
                        Process Refund
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>

          {securityDeposits.length === 0 && (
            <Stack align="center" py="xl">
              <IconShield size={48} color="gray" />
              <Text c="dimmed" ta="center">
                {(searchParams.get("status") || searchParams.get("search"))
                  ? "No security deposits found matching your filters"
                  : "No security deposits recorded yet"
                }
              </Text>
            </Stack>
          )}
        </Card>

        {/* Collect Deposit Modal */}
        <Modal opened={collectOpened} onClose={closeCollect} title="Collect Security Deposit" size="lg">
          <Form method="post">
            <input type="hidden" name="intent" value="collect" />
            <Stack>
              <Select
                label="Booking"
                placeholder="Select booking"
                name="bookingId"
                data={(pendingDeposits || []).map(booking => ({
                  value: booking.id,
                  label: `${booking.user.firstName} ${booking.user.lastName} - Room ${booking.room.number}`
                }))}
                required
                searchable
              />

              <NumberInput
                label="Security Deposit Amount"
                placeholder="Enter amount"
                name="amount"
                min={0}
                step={0.01}
                required
                leftSection="₵"
              />

              <Select
                label="Payment Account"
                placeholder="Select payment account"
                name="paymentAccountId"
                data={[
                  ...(paymentAccounts || []).map(account => {
                    const accountDisplay = account.type === 'CREDIT_CARD' || account.type === 'DEBIT_CARD' 
                      ? `${account.cardBrand || 'Card'} ****${account.cardLast4 || '0000'}` 
                      : account.type === 'BANK_ACCOUNT'
                      ? `${account.bankName || 'Bank'} - ${account.accountName || 'Account'}`
                      : account.type === 'MOBILE_WALLET' || account.type === 'DIGITAL_WALLET'
                      ? `${account.provider || 'Wallet'} - ${account.accountNumber || 'Account'}`
                      : account.type?.replace('_', ' ') || 'Unknown';
                    
                    return {
                      value: account.id,
                      label: `${accountDisplay} ${account.isDefault ? '(Default)' : ''}`.trim()
                    };
                  })
                ]}
                required
              />

              <TextInput
                label="Transaction ID (Optional)"
                placeholder="Enter transaction ID"
                name="transactionId"
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={closeCollect}>
                  Cancel
                </Button>
                <Button type="submit" onClick={closeCollect}>
                  Collect Deposit
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>

        {/* Refund Deposit Modal */}
        <Modal opened={refundOpened} onClose={closeRefund} title="Process Security Deposit Refund" size="lg">
          {selectedDeposit && (
            <Form method="post">
              <input type="hidden" name="intent" value="refund" />
              <input type="hidden" name="depositId" value={selectedDeposit.id} />
              <input type="hidden" name="refundAmount" value={refundAmount} />
              <input type="hidden" name="deductionAmount" value={deductionAmount} />
              <input type="hidden" name="deductionReason" value={deductionReason} />
              <input type="hidden" name="damageReport" value={damageReport} />
              <Stack>
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  title="Deposit Information"
                  color="blue"
                  variant="light"
                >
                  <Text size="sm">
                    Tenant: {selectedDeposit.booking.user.firstName} {selectedDeposit.booking.user.lastName}
                  </Text>
                  <Text size="sm">
                    Room: {selectedDeposit.booking.room.number}
                  </Text>
                  <Text size="sm">
                    Original Deposit: ₵{selectedDeposit.amount.toLocaleString()}
                  </Text>
                </Alert>

                {/* Refund Amount Display */}
                <div>
                  <Text size="sm" fw={500} mb={4}>Refund Amount (Auto-calculated)</Text>
                  <Text size="lg" fw={700} c={refundAmount > 0 ? "green" : "red"}>
                    ₵{refundAmount.toLocaleString()}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Automatically calculated: ₵{selectedDeposit.amount.toLocaleString()} - ₵{deductionAmount.toLocaleString()} = ₵{refundAmount.toLocaleString()}
                  </Text>
                </div>

                {/* Quick Action Buttons */}
                <Group gap="xs" wrap="wrap">
                  <Text size="sm" c="dimmed" w="100%">Quick Actions:</Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="green"
                    onClick={() => setDeductionAmount(0)}
                  >
                    Full Refund
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    onClick={() => setDeductionAmount(selectedDeposit.amount * 0.2)}
                  >
                    20% Deduction
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    onClick={() => setDeductionAmount(selectedDeposit.amount * 0.5)}
                  >
                    50% Deduction
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => setDeductionAmount(selectedDeposit.amount)}
                  >
                    Full Forfeit
                  </Button>
                </Group>

                <NumberInput
                  label="Deduction Amount"
                  placeholder="Enter deduction amount"
                  value={deductionAmount}
                  onChange={(value) => setDeductionAmount(Number(value) || 0)}
                  min={0}
                  max={selectedDeposit.amount}
                  step={0.01}
                  leftSection="₵"
                  description="Enter the amount to be deducted from the deposit"
                  error={
                    (refundAmount + deductionAmount !== selectedDeposit.amount) 
                      ? `Total must equal ₵${selectedDeposit.amount.toLocaleString()}` 
                      : null
                  }
                />

                {deductionAmount > 0 && (
                  <>
                    <TextInput
                      label="Deduction Reason *"
                      placeholder="Reason for deduction (required when deducting)"
                      value={deductionReason}
                      onChange={(event) => setDeductionReason(event.currentTarget.value)}
                      required={deductionAmount > 0}
                      error={deductionAmount > 0 && !deductionReason.trim() ? "Deduction reason is required" : null}
                    />

                    <Textarea
                      label="Damage Report"
                      placeholder="Detailed damage report and assessment"
                      value={damageReport}
                      onChange={(event) => setDamageReport(event.currentTarget.value)}
                      rows={4}
                      description="Provide detailed information about damages or reasons for deduction"
                    />
                  </>
                )}

                {/* Summary Alert */}
                <Alert
                  icon={deductionAmount > 0 ? <IconAlertTriangle size={16} /> : <IconCheck size={16} />}
                  color={deductionAmount > 0 ? "orange" : "green"}
                  variant="light"
                >
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Transaction Summary:</Text>
                  </Group>
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text size="sm">Original Deposit:</Text>
                    <Text size="sm" fw={500}>₵{selectedDeposit.amount.toLocaleString()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Refund to Tenant:</Text>
                    <Text size="sm" fw={500} c="green">₵{refundAmount.toLocaleString()}</Text>
                  </Group>
                  {deductionAmount > 0 && (
                    <Group justify="space-between">
                      <Text size="sm">Deduction:</Text>
                      <Text size="sm" fw={500} c="red">₵{deductionAmount.toLocaleString()}</Text>
                    </Group>
                  )}
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>Status:</Text>
                    <Badge 
                      color={deductionAmount === 0 ? "green" : refundAmount === 0 ? "red" : "orange"}
                      variant="filled"
                    >
                      {deductionAmount === 0 ? "FULL REFUND" : 
                       refundAmount === 0 ? "FORFEITED" : "PARTIAL REFUND"}
                    </Badge>
                  </Group>
                </Alert>

                <Group justify="flex-end">
                  <Button variant="outline" onClick={closeRefund}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    onClick={closeRefund}
                    disabled={!isValidRefundForm()}
                    color={deductionAmount > 0 ? "orange" : "green"}
                  >
                    {deductionAmount === 0 ? "Process Full Refund" : 
                     refundAmount === 0 ? "Forfeit Deposit" : "Process Partial Refund"}
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
