import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  Select,
  TextInput,
  Alert,
  Text,
  Card,
  ActionIcon,
  Switch,
  NumberInput,
  SimpleGrid,
  Paper,
  ThemeIcon,
  Progress,
  Tabs,
  Textarea,
  Divider,
  RingProgress,
  Center,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { 
  IconPlus, 
  IconInfoCircle, 
  IconTrash, 
  IconEdit, 
  IconCreditCard,
  IconWallet,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowUpRight,
  IconArrowDownRight,
  IconCurrencyDollar,
  IconChartBar,
  IconTransfer,
  IconBrandPaypal,
  IconBuildingBank,
} from "@tabler/icons-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { PaymentAccount } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Payment Accounts - Apartment Management" },
    { name: "description", content: "Manage payment accounts and methods" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const paymentAccounts = await db.paymentAccount.findMany({
    orderBy: {
      accountName: "asc",
    },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  // Get analytics data
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Transaction statistics
  const totalTransactions = await db.transaction.count();
  const monthlyTransactions = await db.transaction.count({
    where: {
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  // Transaction volume by status
  const transactionsByStatus = await db.transaction.groupBy({
    by: ["status"],
    _count: {
      id: true,
    },
    _sum: {
      amount: true,
    },
  });

  // Transaction volume by type
  const transactionsByType = await db.transaction.groupBy({
    by: ["type"],
    _count: {
      id: true,
    },
    _sum: {
      amount: true,
    },
  });

  // Transaction volume by payment method
  const transactionsByMethod = await db.transaction.groupBy({
    by: ["method"],
    _count: {
      id: true,
    },
    _sum: {
      amount: true,
    },
  });

  // Payment account statistics
  const accountStats = await Promise.all(
    paymentAccounts.map(async (account) => {
      const transactionVolume = await db.transaction.aggregate({
        where: { paymentAccountId: account.id },
        _sum: { amount: true, fee: true, netAmount: true },
        _count: { id: true },
      });

      const monthlyVolume = await db.transaction.aggregate({
        where: {
          paymentAccountId: account.id,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: { amount: true, fee: true, netAmount: true },
        _count: { id: true },
      });

      const recentTransactions = await db.transaction.findMany({
        where: { paymentAccountId: account.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      return {
        account,
        totalVolume: transactionVolume._sum.amount || 0,
        totalFees: transactionVolume._sum.fee || 0,
        totalNet: transactionVolume._sum.netAmount || 0,
        totalCount: transactionVolume._count.id,
        monthlyVolume: monthlyVolume._sum.amount || 0,
        monthlyCount: monthlyVolume._count.id,
        recentTransactions,
      };
    })
  );

  // Overall financial summary
  const totalVolume = await db.transaction.aggregate({
    _sum: { amount: true, fee: true, netAmount: true },
    _count: { id: true },
  });

  const monthlyVolume = await db.transaction.aggregate({
    where: {
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: { amount: true, fee: true, netAmount: true },
    _count: { id: true },
  });

  // Recent transactions across all accounts
  const recentTransactions = await db.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
      paymentAccount: {
        select: { accountName: true },
      },
      booking: {
        select: { id: true },
      },
    },
  });

  return json({ 
    user, 
    paymentAccounts,
    accountStats,
    analytics: {
      transactionsByStatus,
      transactionsByType,
      transactionsByMethod,
      totalVolume: totalVolume._sum.amount || 0,
      totalFees: totalVolume._sum.fee || 0,
      totalNet: totalVolume._sum.netAmount || 0,
      totalCount: totalVolume._count.id || 0,
      monthlyVolume: monthlyVolume._sum.amount || 0,
      monthlyFees: monthlyVolume._sum.fee || 0,
      monthlyNet: monthlyVolume._sum.netAmount || 0,
      monthlyCount: monthlyVolume._count.id || 0,
    },
    recentTransactions,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  console.log("Action called with intent:", intent);
  console.log("Form data:", Object.fromEntries(formData.entries()));

  try {
    if (intent === "create") {
      const accountName = formData.get("accountName") as string;
      const type = formData.get("type") as any;
      const provider = formData.get("provider") as any;
      const accountNumber = formData.get("accountNumber") as string;
      const bankName = formData.get("bankName") as string;
      const isActive = formData.get("isActive") === "on";

      console.log("Creating payment account:", {
        userId,
        accountName,
        type,
        provider,
        accountNumber,
        bankName,
        isActive,
      });

      if (!accountName || !type || !provider) {
        return json({ error: "Account name, type, and provider are required" }, { status: 400 });
      }

      const newAccount = await db.paymentAccount.create({
        data: {
          userId,
          accountName,
          type,
          provider,
          accountNumber: accountNumber || null,
          bankName: bankName || null,
          isActive,
        },
      });

      console.log("Payment account created:", newAccount);
      return json({ success: "Payment account created successfully" });
    }

    if (intent === "update") {
      const id = formData.get("id") as string;
      const accountName = formData.get("accountName") as string;
      const type = formData.get("type") as any;
      const provider = formData.get("provider") as any;
      const accountNumber = formData.get("accountNumber") as string;
      const bankName = formData.get("bankName") as string;
      const isActive = formData.get("isActive") === "on";

      console.log("Updating payment account:", {
        id,
        accountName,
        type,
        provider,
        accountNumber,
        bankName,
        isActive,
      });

      if (!id) {
        return json({ error: "Payment account ID is required for update" }, { status: 400 });
      }

      const updatedAccount = await db.paymentAccount.update({
        where: { id },
        data: {
          accountName,
          type,
          provider,
          accountNumber: accountNumber || null,
          bankName: bankName || null,
          isActive,
        },
      });

      console.log("Payment account updated:", updatedAccount);
      return json({ success: "Payment account updated successfully" });
    }

    if (intent === "delete") {
      const id = formData.get("id") as string;

      if (!id) {
        return json({ error: "Payment account ID is required" }, { status: 400 });
      }

      await db.paymentAccount.delete({
        where: { id },
      });

      return json({ success: "Payment account deleted successfully" });
    }

    if (intent === "transfer") {
      const fromAccountId = formData.get("fromAccountId") as string;
      const toAccountId = formData.get("toAccountId") as string;
      const amountStr = formData.get("amount") as string;
      const description = formData.get("description") as string;
      const reference = formData.get("reference") as string;

      console.log("Transfer data received:", {
        fromAccountId,
        toAccountId,
        amountStr,
        description,
        reference
      });

      // Enhanced validation
      if (!fromAccountId || !toAccountId) {
        return json({ error: "Please select both source and destination accounts" }, { status: 400 });
      }

      if (fromAccountId === toAccountId) {
        return json({ error: "Cannot transfer to the same account" }, { status: 400 });
      }

      if (!amountStr || amountStr.trim() === "") {
        return json({ error: "Please enter a transfer amount" }, { status: 400 });
      }

      // Clean the amount string to remove any currency symbols or formatting
      const cleanAmountStr = amountStr.replace(/[₵$,\s]/g, '');
      const amount = parseFloat(cleanAmountStr);
      
      console.log("Amount parsing:", { original: amountStr, cleaned: cleanAmountStr, parsed: amount });
      
      if (isNaN(amount) || amount <= 0) {
        return json({ error: "Please enter a valid amount greater than 0" }, { status: 400 });
      }

      if (amount > 1000000) {
        return json({ error: "Transfer amount cannot exceed ₵1,000,000" }, { status: 400 });
      }

      // Get account details
      const fromAccount = await db.paymentAccount.findUnique({
        where: { id: fromAccountId },
      });

      const toAccount = await db.paymentAccount.findUnique({
        where: { id: toAccountId },
      });

      if (!fromAccount || !toAccount) {
        return json({ error: "Invalid account selected" }, { status: 400 });
      }

      if (!fromAccount.isActive || !toAccount.isActive) {
        return json({ error: "Cannot transfer from/to inactive accounts" }, { status: 400 });
      }

      // Create transfer transactions
      const transferNumber = `TXN-${Date.now()}`;
      
      // Debit transaction (outgoing)
      const debitTransaction = await db.transaction.create({
        data: {
          transactionNumber: `${transferNumber}-OUT`,
          userId,
          paymentAccountId: fromAccountId,
          amount: -amount, // Negative for outgoing
          fee: 0,
          netAmount: -amount,
          type: "WITHDRAWAL",
          status: "COMPLETED",
          method: "BANK_TRANSFER",
          provider: fromAccount.provider,
          reference: reference || undefined,
          description: description || `Transfer to ${toAccount.accountName}`,
          processedAt: new Date(),
        },
      });

      // Credit transaction (incoming)
      const creditTransaction = await db.transaction.create({
        data: {
          transactionNumber: `${transferNumber}-IN`,
          userId,
          paymentAccountId: toAccountId,
          amount: amount, // Positive for incoming
          fee: 0,
          netAmount: amount,
          type: "DEPOSIT",
          status: "COMPLETED",
          method: "BANK_TRANSFER",
          provider: toAccount.provider,
          reference: reference || undefined,
          description: description || `Transfer from ${fromAccount.accountName}`,
          processedAt: new Date(),
        },
      });

      return json({ 
        success: `Transfer of ₵${amount.toFixed(2)} from ${fromAccount.accountName} to ${toAccount.accountName} completed successfully` 
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Payment account action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function PaymentAccounts() {
  const { user, paymentAccounts, accountStats, analytics, recentTransactions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [transferData, setTransferData] = useState({
    fromAccountId: "",
    toAccountId: "", 
    amount: "",
  });

  const getTypeColor = (type: PaymentAccount["type"]) => {
    switch (type) {
      case "CREDIT_CARD":
        return "blue";
      case "DEBIT_CARD":
        return "cyan";
      case "BANK_ACCOUNT":
        return "green";
      case "MOBILE_WALLET":
        return "orange";
      case "DIGITAL_WALLET":
        return "violet";
      case "CRYPTO_WALLET":
        return "purple";
      default:
        return "gray";
    }
  };

  const getProviderColor = (provider: PaymentAccount["provider"]) => {
    switch (provider) {
      case "STRIPE":
        return "violet";
      case "PAYPAL":
        return "blue";
      case "MTN_MOBILE_MONEY":
        return "yellow";
      case "VODAFONE_CASH":
        return "red";
      case "GCB_BANK":
        return "green";
      case "ECOBANK":
        return "orange";
      default:
        return "gray";
    }
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    open();
  };

  const handleDelete = (accountId: string) => {
    if (confirm("Are you sure you want to delete this payment account? This action cannot be undone.")) {
      const form = new FormData();
      form.append("intent", "delete");
      form.append("id", accountId);
      fetch("/dashboard/payment-accounts", {
        method: "POST",
        body: form,
      }).then(() => window.location.reload());
    }
  };

  const handleModalClose = () => {
    setEditingAccount(null);
    close();
  };

  const handleTransferClose = () => {
    setTransferData({
      fromAccountId: "",
      toAccountId: "",
      amount: "",
    });
    closeTransfer();
  };

  // Validate transfer data client-side
  const isTransferValid = () => {
    if (!transferData.fromAccountId || !transferData.toAccountId) return false;
    if (transferData.fromAccountId === transferData.toAccountId) return false;
    if (!transferData.amount || parseFloat(transferData.amount) <= 0) return false;
    return true;
  };

  // Close modal on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData) {
      handleModalClose();
      handleTransferClose();
    }
  }, [actionData]);

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Analytics cards data
  const analyticsCards = [
    {
      title: "Total Volume",
      value: formatCurrency(analytics.totalVolume),
      subtitle: `${analytics.totalCount} transactions`,
      icon: IconCurrencyDollar,
      color: "blue",
    },
    {
      title: "Monthly Volume",
      value: formatCurrency(analytics.monthlyVolume),
      subtitle: `${analytics.monthlyCount} this month`,
      icon: IconTrendingUp,
      color: "green",
    },
    {
      title: "Total Fees",
      value: formatCurrency(analytics.totalFees),
      subtitle: `Monthly: ${formatCurrency(analytics.monthlyFees)}`,
      icon: IconChartBar,
      color: "orange",
    },
    {
      title: "Net Revenue",
      value: formatCurrency(analytics.totalNet),
      subtitle: `Monthly: ${formatCurrency(analytics.monthlyNet)}`,
      icon: IconWallet,
      color: "violet",
    },
  ];

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Payment Accounts</Title>
          <Group>
            {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
              <>
                <Button leftSection={<IconTransfer size={16} />} onClick={openTransfer} variant="light">
                  Transfer Funds
                </Button>
                <Button leftSection={<IconPlus size={16} />} onClick={open}>
                  Add Account
                </Button>
              </>
            )}
          </Group>
        </Group>

        {actionData && 'error' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData && 'success' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
            variant="light"
          >
            {actionData.success}
          </Alert>
        )}

        {/* Analytics Overview */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {analyticsCards.map((card, index) => (
            <Card key={index} withBorder padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="sm" fw={500} tt="uppercase">
                    {card.title}
                  </Text>
                  <Text fw={700} size="xl" mt="xs">
                    {card.value}
                  </Text>
                  <Text c="dimmed" size="xs" mt={4}>
                    {card.subtitle}
                  </Text>
                </div>
                <ThemeIcon color={card.color} size={38} radius="md" variant="light">
                  <card.icon size={22} />
                </ThemeIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Tabs defaultValue="accounts">
          <Tabs.List>
            <Tabs.Tab value="accounts" leftSection={<IconCreditCard size={16} />}>
              Payment Accounts
            </Tabs.Tab>
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics & Stats
            </Tabs.Tab>
            <Tabs.Tab value="transactions" leftSection={<IconWallet size={16} />}>
              Recent Transactions
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="accounts" pt="md">
            <Card withBorder>
              <Table.ScrollContainer minWidth={800}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Provider</Table.Th>
                      <Table.Th>Account Number</Table.Th>
                      <Table.Th>Bank Name</Table.Th>
                      <Table.Th>Volume</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Created</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paymentAccounts.map((account) => {
                      const stats = accountStats.find(s => s.account.id === account.id);
                      return (
                        <Table.Tr key={account.id}>
                          <Table.Td>
                            <Group gap="sm">
                              <IconCreditCard size={16} />
                              <div>
                                <Text fw={500}>{account.accountName || "Unknown Account"}</Text>
                                <Text size="xs" c="dimmed">{stats?.totalCount || 0} transactions</Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={getTypeColor(account.type)} size="sm">
                              {account.type.replace("_", " ")}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={getProviderColor(account.provider)} size="sm">
                              {account.provider}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {account.accountNumber || "N/A"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {account.bankName || "N/A"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <div>
                              <Text size="sm" fw={500}>
                                {formatCurrency(stats?.totalVolume || 0)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Monthly: {formatCurrency(stats?.monthlyVolume || 0)}
                              </Text>
                            </div>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={account.isActive ? "green" : "red"} size="sm">
                              {account.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {format(new Date(account.createdAt), "MMM dd, yyyy")}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                                <>
                                  <ActionIcon
                                    color="blue"
                                    variant="light"
                                    size="sm"
                                    onClick={() => handleEdit(account)}
                                    title="Edit account"
                                  >
                                    <IconEdit size={14} />
                                  </ActionIcon>
                                  {user?.role === "ADMIN" && (
                                    <ActionIcon
                                      color="red"
                                      variant="light"
                                      size="sm"
                                      onClick={() => handleDelete(account.id)}
                                      title="Delete account"
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  )}
                                </>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                    {paymentAccounts.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={9}>
                          <Text ta="center" c="dimmed">
                            No payment accounts configured yet
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="analytics" pt="md">
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              {/* Transaction Status Distribution */}
              <Card withBorder padding="lg">
                <Title order={4} mb="md">Transaction Status</Title>
                <Stack gap="sm">
                  {analytics.transactionsByStatus.map((item) => {
                    const total = analytics.totalCount;
                    const count = item._count.id;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <Group key={item.status} justify="space-between">
                        <Group gap="sm">
                          <Badge 
                            color={
                              item.status === 'COMPLETED' ? 'green' :
                              item.status === 'PENDING' ? 'yellow' :
                              item.status === 'FAILED' ? 'red' : 'gray'
                            }
                            size="sm"
                          >
                            {item.status}
                          </Badge>
                          <Text size="sm">{item._count.id} transactions</Text>
                        </Group>
                        <Text size="sm" fw={500}>
                          {formatCurrency(item._sum.amount || 0)}
                        </Text>
                      </Group>
                    );
                  })}
                </Stack>
              </Card>

              {/* Transaction Type Distribution */}
              <Card withBorder padding="lg">
                <Title order={4} mb="md">Transaction Types</Title>
                <Stack gap="sm">
                  {analytics.transactionsByType.map((item) => (
                    <Group key={item.type} justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon
                          size="sm"
                          color={
                            item.type === 'PAYMENT' ? 'green' :
                            item.type === 'REFUND' ? 'red' :
                            item.type === 'DEPOSIT' ? 'blue' : 'orange'
                          }
                          variant="light"
                        >
                          {item.type === 'PAYMENT' ? <IconArrowDownRight size={12} /> :
                           item.type === 'REFUND' ? <IconArrowUpRight size={12} /> :
                           <IconCurrencyDollar size={12} />}
                        </ThemeIcon>
                        <Text size="sm">{item.type}</Text>
                        <Text size="xs" c="dimmed">({item._count.id})</Text>
                      </Group>
                      <Text size="sm" fw={500}>
                        {formatCurrency(item._sum.amount || 0)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>

              {/* Payment Method Distribution */}
              <Card withBorder padding="lg">
                <Title order={4} mb="md">Payment Methods</Title>
                <Stack gap="sm">
                  {analytics.transactionsByMethod.map((item) => (
                    <Group key={item.method} justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon size="sm" color="blue" variant="light">
                          {item.method.includes('CARD') ? <IconCreditCard size={12} /> :
                           item.method === 'PAYPAL' ? <IconBrandPaypal size={12} /> :
                           <IconBuildingBank size={12} />}
                        </ThemeIcon>
                        <div>
                          <Text size="sm">{item.method.replace('_', ' ')}</Text>
                          <Text size="xs" c="dimmed">{item._count.id} transactions</Text>
                        </div>
                      </Group>
                      <Text size="sm" fw={500}>
                        {formatCurrency(item._sum.amount || 0)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>

              {/* Account Performance */}
              <Card withBorder padding="lg">
                <Title order={4} mb="md">Account Performance</Title>
                <Stack gap="sm">
                  {accountStats
                    .sort((a, b) => b.totalVolume - a.totalVolume)
                    .slice(0, 5)
                    .map((stats) => (
                      <Group key={stats.account.id} justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>
                            {stats.account.accountName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {stats.totalCount} transactions
                          </Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={500}>
                            {formatCurrency(stats.totalVolume)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Fees: {formatCurrency(stats.totalFees)}
                          </Text>
                        </div>
                      </Group>
                    ))}
                </Stack>
              </Card>
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="transactions" pt="md">
            <Card withBorder>
              <Title order={4} mb="md">Recent Transactions</Title>
              <Table.ScrollContainer minWidth={800}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Transaction #</Table.Th>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Account</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Method</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {recentTransactions.map((transaction) => (
                      <Table.Tr key={transaction.id}>
                        <Table.Td>
                          <Text size="sm" ff="monospace">
                            {transaction.transactionNumber}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {transaction.user.firstName} {transaction.user.lastName}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {transaction.paymentAccount?.accountName || 'N/A'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            size="sm"
                            color={
                              transaction.type === 'PAYMENT' ? 'green' :
                              transaction.type === 'REFUND' ? 'red' :
                              transaction.type === 'DEPOSIT' ? 'blue' : 'orange'
                            }
                          >
                            {transaction.type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{transaction.method}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text 
                            size="sm" 
                            fw={500}
                            c={transaction.amount >= 0 ? 'green' : 'red'}
                          >
                            {formatCurrency(transaction.amount)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="sm"
                            color={
                              transaction.status === 'COMPLETED' ? 'green' :
                              transaction.status === 'PENDING' ? 'yellow' :
                              transaction.status === 'FAILED' ? 'red' : 'gray'
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {recentTransactions.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={8}>
                          <Text ta="center" c="dimmed">
                            No recent transactions found
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          </Tabs.Panel>
        </Tabs>

        {/* Account Transfer Modal */}
        <Modal 
          opened={transferOpened} 
          onClose={handleTransferClose} 
          title="Transfer Funds Between Accounts" 
          size="lg"
        >
          <Form method="post">
            <input type="hidden" name="intent" value="transfer" />
            <input type="hidden" name="amount" value={transferData.amount} />
            <Stack>
              <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
                Transfer funds between your active payment accounts. Both accounts must be active.
              </Alert>

              <Select
                label="From Account"
                placeholder="Select source account"
                name="fromAccountId"
                value={transferData.fromAccountId}
                onChange={(value) => setTransferData(prev => ({ ...prev, fromAccountId: value || "" }))}
                data={paymentAccounts
                  .filter(account => account.isActive)
                  .map(account => ({
                    value: account.id,
                    label: `${account.accountName} (${account.provider})`,
                  }))}
                required
                error={transferData.fromAccountId === transferData.toAccountId && transferData.toAccountId ? "Cannot transfer to the same account" : ""}
              />

              <Select
                label="To Account"
                placeholder="Select destination account"
                name="toAccountId"
                value={transferData.toAccountId}
                onChange={(value) => setTransferData(prev => ({ ...prev, toAccountId: value || "" }))}
                data={paymentAccounts
                  .filter(account => account.isActive && account.id !== transferData.fromAccountId)
                  .map(account => ({
                    value: account.id,
                    label: `${account.accountName} (${account.provider})`,
                  }))}
                required
                error={transferData.fromAccountId === transferData.toAccountId && transferData.fromAccountId ? "Cannot transfer to the same account" : ""}
              />

              <NumberInput
                label="Transfer Amount (GHS)"
                placeholder="Enter amount to transfer"
                value={transferData.amount}
                onChange={(value) => setTransferData(prev => ({ ...prev, amount: String(value || "") }))}
                min={0.01}
                max={1000000}
                step={0.01}
                decimalScale={2}
                description="Minimum: ₵0.01, Maximum: ₵1,000,000"
                required
                error={transferData.amount && (parseFloat(transferData.amount) <= 0 || isNaN(parseFloat(transferData.amount))) ? "Please enter a valid amount greater than 0" : ""}
              />

              <TextInput
                label="Reference (Optional)"
                placeholder="e.g., TXN-12345 or Invoice #123"
                name="reference"
                description="Internal reference for tracking"
              />

              <Textarea
                label="Description (Optional)"
                placeholder="Describe the purpose of this transfer (e.g., Account rebalancing, Payment processing fees)"
                name="description"
                rows={3}
                description="This will appear in the transaction history"
              />

              <Divider />

              {/* Transfer Preview */}
              {isTransferValid() && (
                <Card withBorder p="md" bg="gray.0">
                  <Title order={5} mb="sm">Transfer Summary</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">From:</Text>
                      <Text size="sm" fw={500}>
                        {paymentAccounts.find(a => a.id === transferData.fromAccountId)?.accountName}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">To:</Text>
                      <Text size="sm" fw={500}>
                        {paymentAccounts.find(a => a.id === transferData.toAccountId)?.accountName}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Amount:</Text>
                      <Text size="sm" fw={700} c="green">
                        ₵{parseFloat(transferData.amount || "0").toFixed(2)}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              )}

              <Divider />

              <Group justify="flex-end">
                <Button variant="outline" onClick={handleTransferClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  leftSection={<IconTransfer size={16} />}
                  disabled={!isTransferValid()}
                >
                  Transfer Funds
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>

        {/* Add/Edit Account Modal */}
        <Modal 
          opened={opened} 
          onClose={handleModalClose} 
          title={editingAccount ? "Edit Payment Account" : "Add Payment Account"} 
          size="lg"
        >
          <Form method="post">
            <input type="hidden" name="intent" value={editingAccount ? "update" : "create"} />
            {editingAccount && <input type="hidden" name="id" value={editingAccount.id} />}
            <Stack>
              <TextInput
                label="Account Name"
                placeholder="e.g., Main Stripe Account"
                name="accountName"
                defaultValue={editingAccount?.accountName || ""}
                required
              />

              <Select
                label="Account Type"
                placeholder="Select account type"
                name="type"
                defaultValue={editingAccount?.type || ""}
                data={[
                  { value: "CREDIT_CARD", label: "Credit Card" },
                  { value: "DEBIT_CARD", label: "Debit Card" },
                  { value: "BANK_ACCOUNT", label: "Bank Account" },
                  { value: "MOBILE_WALLET", label: "Mobile Wallet" },
                  { value: "DIGITAL_WALLET", label: "Digital Wallet" },
                  { value: "CRYPTO_WALLET", label: "Crypto Wallet" },
                ]}
                required
              />

              <Select
                label="Provider"
                placeholder="Select payment provider"
                name="provider"
                defaultValue={editingAccount?.provider || ""}
                data={[
                  { value: "STRIPE", label: "Stripe" },
                  { value: "PAYPAL", label: "PayPal" },
                  { value: "MTN_MOBILE_MONEY", label: "MTN Mobile Money" },
                  { value: "VODAFONE_CASH", label: "Vodafone Cash" },
                  { value: "GCB_BANK", label: "GCB Bank" },
                  { value: "ECOBANK", label: "Ecobank" },
                  { value: "MANUAL", label: "Manual" },
                ]}
                required
              />

              <TextInput
                label="Account Number/ID (Optional)"
                placeholder="Account number or identifier"
                name="accountNumber"
                defaultValue={editingAccount?.accountNumber || ""}
              />

              <TextInput
                label="Bank Name (Optional)"
                placeholder="e.g., GCB Bank"
                name="bankName"
                defaultValue={editingAccount?.bankName || ""}
              />

              <Switch
                label="Active Account"
                name="isActive"
                defaultChecked={editingAccount?.isActive ?? true}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAccount ? "Update Account" : "Create Account"}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
