import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Alert,
  Text,
  Card,
  Grid,
  Flex,
  Select,
  Paper,
  Progress,
  RingProgress,
  ThemeIcon,
  Divider,
  Tabs,
} from "@mantine/core";
import { 
  IconCurrencyDollar,
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconShield,
  IconCalendar,
  IconChartBar,
  IconReport,
  IconCreditCard,
  IconCash,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconFilter,
  IconDownload,
} from "@tabler/icons-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Payment, SecurityDeposit, Booking, User, Room } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Financial Reports - Apartment Management" },
    { name: "description", content: "View financial reports, revenue analytics, and guest balances" },
  ];
};

interface RevenueData {
  totalRevenue: number;
  totalPayments: number;
  totalSecurityDeposits: number;
  totalRefunds: number;
  totalForfeited: number;
  netRevenue: number;
  averageBookingValue: number;
  totalBookings: number;
}

interface GuestBalance {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  totalPaid: number;
  totalSecurityDeposits: number;
  totalRefunds: number;
  outstandingBalance: number;
  bookingCount: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  payments: number;
  securityDeposits: number;
  bookings: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    throw new Response("Unauthorized", { status: 403 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "thisMonth";

  // Calculate date ranges
  let startDate: Date;
  let endDate: Date;
  
  switch (period) {
    case "thisMonth":
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
      break;
    case "lastMonth":
      const lastMonth = subMonths(new Date(), 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    case "thisYear":
      startDate = startOfYear(new Date());
      endDate = endOfYear(new Date());
      break;
    case "lastYear":
      const lastYear = subYears(new Date(), 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      break;
    default:
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
  }

  // Get payment data
  const payments = await db.payment.findMany({
    where: {
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "COMPLETED",
    },
    include: {
      booking: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          room: {
            select: { number: true },
          },
        },
      },
    },
  });

  // Get security deposit data
  const securityDeposits = await db.securityDeposit.findMany({
    where: {
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      booking: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  // Get all bookings for the period
  const bookings = await db.booking.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: "CANCELLED" },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      payment: true,
      securityDeposit: true,
    },
  });

  // Calculate revenue data
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalSecurityDepositsCollected = securityDeposits
    .filter(d => d.status === "PAID")
    .reduce((sum, deposit) => sum + deposit.amount, 0);
  const totalRefunds = securityDeposits
    .filter(d => ["REFUNDED", "PARTIALLY_REFUNDED"].includes(d.status))
    .reduce((sum, deposit) => sum + (deposit.refundAmount || 0), 0);
  const totalForfeited = securityDeposits
    .filter(d => ["PARTIALLY_REFUNDED", "FORFEITED"].includes(d.status))
    .reduce((sum, deposit) => sum + (deposit.deductionAmount || 0), 0);

  const revenueData: RevenueData = {
    totalRevenue: totalPayments + totalForfeited,
    totalPayments,
    totalSecurityDeposits: totalSecurityDepositsCollected,
    totalRefunds,
    totalForfeited,
    netRevenue: totalPayments + totalForfeited - totalRefunds,
    averageBookingValue: bookings.length > 0 ? totalPayments / bookings.length : 0,
    totalBookings: bookings.length,
  };

  // Calculate guest balances
  const guestBalances: GuestBalance[] = [];
  const userMap = new Map<string, GuestBalance>();

  // Process payments
  payments.forEach(payment => {
    const userId = payment.booking.user.id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        firstName: payment.booking.user.firstName,
        lastName: payment.booking.user.lastName,
        email: payment.booking.user.email,
        totalPaid: 0,
        totalSecurityDeposits: 0,
        totalRefunds: 0,
        outstandingBalance: 0,
        bookingCount: 0,
      });
    }
    const guest = userMap.get(userId)!;
    guest.totalPaid += payment.amount;
  });

  // Process security deposits
  securityDeposits.forEach(deposit => {
    const userId = deposit.booking.user.id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        firstName: deposit.booking.user.firstName,
        lastName: deposit.booking.user.lastName,
        email: deposit.booking.user.email,
        totalPaid: 0,
        totalSecurityDeposits: 0,
        totalRefunds: 0,
        outstandingBalance: 0,
        bookingCount: 0,
      });
    }
    const guest = userMap.get(userId)!;
    if (deposit.status === "PAID") {
      guest.totalSecurityDeposits += deposit.amount;
    }
    if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(deposit.status)) {
      guest.totalRefunds += deposit.refundAmount || 0;
    }
  });

  // Process bookings to get booking counts
  bookings.forEach(booking => {
    const userId = booking.user.id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        firstName: booking.user.firstName,
        lastName: booking.user.lastName,
        email: booking.user.email,
        totalPaid: 0,
        totalSecurityDeposits: 0,
        totalRefunds: 0,
        outstandingBalance: 0,
        bookingCount: 0,
      });
    }
    const guest = userMap.get(userId)!;
    guest.bookingCount++;
    
    // Calculate outstanding balance
    if (!booking.payment) {
      guest.outstandingBalance += booking.totalAmount;
    }
  });

  guestBalances.push(...Array.from(userMap.values()));

  // Calculate monthly trends (last 6 months)
  const monthlyTrends: MonthlyTrend[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthPayments = await db.payment.findMany({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
        status: "COMPLETED",
      },
    });

    const monthDeposits = await db.securityDeposit.findMany({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
        status: "PAID",
      },
    });

    const monthBookings = await db.booking.findMany({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        status: { not: "CANCELLED" },
      },
    });

    monthlyTrends.push({
      month: format(monthDate, "MMM yyyy"),
      revenue: monthPayments.reduce((sum, p) => sum + p.amount, 0),
      payments: monthPayments.length,
      securityDeposits: monthDeposits.reduce((sum, d) => sum + d.amount, 0),
      bookings: monthBookings.length,
    });
  }

  return json({
    user,
    revenueData,
    guestBalances: guestBalances.sort((a, b) => b.totalPaid - a.totalPaid),
    monthlyTrends,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
}

export default function Reports() {
  const { user, revenueData, guestBalances, monthlyTrends, period } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePeriodChange = (value: string | null) => {
    if (value) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("period", value);
      setSearchParams(newParams);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "thisMonth": return "This Month";
      case "lastMonth": return "Last Month";
      case "thisYear": return "This Year";
      case "lastYear": return "Last Year";
      default: return "This Month";
    }
  };

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={2}>Financial Reports</Title>
            <Text c="dimmed" size="sm">
              Revenue analytics, guest balances, and financial statistics
            </Text>
          </div>
          <Group>
            <Select
              value={period}
              onChange={handlePeriodChange}
              data={[
                { value: "thisMonth", label: "This Month" },
                { value: "lastMonth", label: "Last Month" },
                { value: "thisYear", label: "This Year" },
                { value: "lastYear", label: "Last Year" },
              ]}
              leftSection={<IconCalendar size={16} />}
            />
            <Button
              leftSection={<IconDownload size={16} />}
              variant="light"
              onClick={() => window.print()}
            >
              Export Report
            </Button>
          </Group>
        </Group>

        <Alert
          icon={<IconReport size={16} />}
          title={`Financial Summary for ${getPeriodLabel(period)}`}
          color="blue"
          variant="light"
        >
          <Text size="sm">
            This report shows all financial transactions and analytics for the selected period.
          </Text>
        </Alert>

        <Tabs defaultValue="overview" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="revenue" leftSection={<IconCurrencyDollar size={16} />}>
              Revenue Details
            </Tabs.Tab>
            <Tabs.Tab value="guests" leftSection={<IconUsers size={16} />}>
              Guest Balances
            </Tabs.Tab>
            <Tabs.Tab value="trends" leftSection={<IconTrendingUp size={16} />}>
              Trends
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="xl">
            {/* Key Metrics Cards */}
            <Grid mb="xl">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card>
                  <Group>
                    <RingProgress
                      size={80}
                      thickness={8}
                      sections={[
                        { value: 100, color: "green" }
                      ]}
                      label={
                        <ThemeIcon color="green" variant="light" size="lg">
                          <IconCurrencyDollar size={20} />
                        </ThemeIcon>
                      }
                    />
                    <div>
                      <Text c="dimmed" size="sm">Total Revenue</Text>
                      <Text fw={700} size="xl">{formatCurrency(revenueData.totalRevenue)}</Text>
                      <Text size="xs" c="green">
                        <IconTrendingUp size={12} /> Net Income
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card>
                  <Group>
                    <RingProgress
                      size={80}
                      thickness={8}
                      sections={[
                        { value: 100, color: "blue" }
                      ]}
                      label={
                        <ThemeIcon color="blue" variant="light" size="lg">
                          <IconCreditCard size={20} />
                        </ThemeIcon>
                      }
                    />
                    <div>
                      <Text c="dimmed" size="sm">Payments Received</Text>
                      <Text fw={700} size="xl">{formatCurrency(revenueData.totalPayments)}</Text>
                      <Text size="xs" c="blue">
                        From {revenueData.totalBookings} bookings
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card>
                  <Group>
                    <RingProgress
                      size={80}
                      thickness={8}
                      sections={[
                        { value: 100, color: "orange" }
                      ]}
                      label={
                        <ThemeIcon color="orange" variant="light" size="lg">
                          <IconShield size={20} />
                        </ThemeIcon>
                      }
                    />
                    <div>
                      <Text c="dimmed" size="sm">Security Deposits</Text>
                      <Text fw={700} size="xl">{formatCurrency(revenueData.totalSecurityDeposits)}</Text>
                      <Text size="xs" c="orange">
                        Collected
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card>
                  <Group>
                    <RingProgress
                      size={80}
                      thickness={8}
                      sections={[
                        { value: (revenueData.totalForfeited / (revenueData.totalSecurityDeposits || 1)) * 100, color: "red" }
                      ]}
                      label={
                        <ThemeIcon color="red" variant="light" size="lg">
                          <IconAlertTriangle size={20} />
                        </ThemeIcon>
                      }
                    />
                    <div>
                      <Text c="dimmed" size="sm">Forfeited</Text>
                      <Text fw={700} size="xl">{formatCurrency(revenueData.totalForfeited)}</Text>
                      <Text size="xs" c="red">
                        From damages
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Revenue Breakdown */}
            <Card>
              <Title order={3} mb="md">Revenue Breakdown</Title>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text>Booking Payments</Text>
                      <Text fw={500}>{formatCurrency(revenueData.totalPayments)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text>Forfeited Deposits</Text>
                      <Text fw={500}>{formatCurrency(revenueData.totalForfeited)}</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text fw={700}>Gross Revenue</Text>
                      <Text fw={700}>{formatCurrency(revenueData.totalRevenue)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text c="red">Refunds</Text>
                      <Text c="red">-{formatCurrency(revenueData.totalRefunds)}</Text>
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                      <Text fw={700} size="lg">Net Revenue</Text>
                      <Text fw={700} size="lg" c="green">{formatCurrency(revenueData.netRevenue)}</Text>
                    </Group>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="sm">
                    <Text fw={500} mb="sm">Key Metrics</Text>
                    <Group justify="space-between">
                      <Text>Total Bookings</Text>
                      <Text fw={500}>{revenueData.totalBookings}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text>Average Booking Value</Text>
                      <Text fw={500}>{formatCurrency(revenueData.averageBookingValue)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text>Security Deposits Collected</Text>
                      <Text fw={500}>{formatCurrency(revenueData.totalSecurityDeposits)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text>Damage Recovery Rate</Text>
                      <Text fw={500}>
                        {revenueData.totalSecurityDeposits > 0 
                          ? ((revenueData.totalForfeited / revenueData.totalSecurityDeposits) * 100).toFixed(1)
                          : 0}%
                      </Text>
                    </Group>
                  </Stack>
                </Grid.Col>
              </Grid>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="revenue" pt="xl">
            <Card>
              <Title order={3} mb="md">Detailed Revenue Analysis</Title>
              <Stack gap="lg">
                <Paper p="md" withBorder>
                  <Text fw={500} mb="sm">Payment Methods Breakdown</Text>
                  <Text size="sm" c="dimmed">Revenue distribution by payment method</Text>
                  {/* This would need additional data from the loader */}
                </Paper>

                <Paper p="md" withBorder>
                  <Text fw={500} mb="sm">Monthly Revenue Progress</Text>
                  <Progress 
                    value={(revenueData.totalRevenue / 10000) * 100} 
                    label={`${formatCurrency(revenueData.totalRevenue)} / ${formatCurrency(10000)} target`}
                    size="xl"
                    color="green"
                  />
                  <Text size="sm" c="dimmed" mt="xs">
                    Progress towards monthly revenue target
                  </Text>
                </Paper>

                <Paper p="md" withBorder>
                  <Text fw={500} mb="sm">Revenue Efficiency</Text>
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="sm">Revenue per Booking</Text>
                      <Text fw={700} size="lg">{formatCurrency(revenueData.averageBookingValue)}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="sm">Collection Rate</Text>
                      <Text fw={700} size="lg">
                        {((revenueData.totalPayments / (revenueData.totalPayments + (guestBalances.reduce((sum, guest) => sum + guest.outstandingBalance, 0)))) * 100).toFixed(1)}%
                      </Text>
                    </Grid.Col>
                  </Grid>
                </Paper>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="guests" pt="xl">
            <Card>
              <Group justify="space-between" mb="md">
                <Title order={3}>Guest Financial Summary</Title>
                <Text size="sm" c="dimmed">
                  {guestBalances.length} guests with financial activity
                </Text>
              </Group>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Guest</Table.Th>
                    <Table.Th>Bookings</Table.Th>
                    <Table.Th>Total Paid</Table.Th>
                    <Table.Th>Security Deposits</Table.Th>
                    <Table.Th>Refunds</Table.Th>
                    <Table.Th>Outstanding</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {guestBalances.map((guest) => (
                    <Table.Tr key={guest.userId}>
                      <Table.Td>
                        <div>
                          <Text fw={500}>
                            {guest.firstName} {guest.lastName}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {guest.email}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {guest.bookingCount}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} c="green">
                          {formatCurrency(guest.totalPaid)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>
                          {formatCurrency(guest.totalSecurityDeposits)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} c="blue">
                          {formatCurrency(guest.totalRefunds)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} c={guest.outstandingBalance > 0 ? "red" : "gray"}>
                          {formatCurrency(guest.outstandingBalance)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={guest.outstandingBalance > 0 ? "red" : "green"} 
                          variant="light"
                        >
                          {guest.outstandingBalance > 0 ? "Outstanding" : "Paid"}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {guestBalances.length === 0 && (
                <Stack align="center" py="xl">
                  <IconUsers size={48} color="gray" />
                  <Text c="dimmed" ta="center">
                    No guest financial activity found for this period
                  </Text>
                </Stack>
              )}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="trends" pt="xl">
            <Card>
              <Title order={3} mb="md">6-Month Financial Trends</Title>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Month</Table.Th>
                    <Table.Th>Revenue</Table.Th>
                    <Table.Th>Payments</Table.Th>
                    <Table.Th>Security Deposits</Table.Th>
                    <Table.Th>Bookings</Table.Th>
                    <Table.Th>Trend</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {monthlyTrends.map((trend, index) => {
                    const prevRevenue = index > 0 ? monthlyTrends[index - 1].revenue : trend.revenue;
                    const isGrowth = trend.revenue >= prevRevenue;
                    return (
                      <Table.Tr key={trend.month}>
                        <Table.Td>
                          <Text fw={500}>{trend.month}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500}>{formatCurrency(trend.revenue)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue">
                            {trend.payments}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text>{formatCurrency(trend.securityDeposits)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="green">
                            {trend.bookings}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {isGrowth ? (
                              <IconTrendingUp size={16} color="green" />
                            ) : (
                              <IconTrendingDown size={16} color="red" />
                            )}
                            <Text size="sm" c={isGrowth ? "green" : "red"}>
                              {index > 0 
                                ? `${((trend.revenue - prevRevenue) / prevRevenue * 100).toFixed(1)}%`
                                : "N/A"
                              }
                            </Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </DashboardLayout>
  );
}
