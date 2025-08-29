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
  IconFileExport,
  IconFileSpreadsheet,
} from "@tabler/icons-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  subMonths, 
  subYears,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subQuarters,
} from "date-fns";
import  DashboardLayout   from "~/components/DashboardLayout";
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
    case "today":
      startDate = startOfDay(new Date());
      endDate = endOfDay(new Date());
      break;
    case "yesterday":
      const yesterday = subDays(new Date(), 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      break;
    case "thisWeek":
      startDate = startOfWeek(new Date());
      endDate = endOfWeek(new Date());
      break;
    case "lastWeek":
      const lastWeek = subWeeks(new Date(), 1);
      startDate = startOfWeek(lastWeek);
      endDate = endOfWeek(lastWeek);
      break;
    case "thisMonth":
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
      break;
    case "lastMonth":
      const lastMonth = subMonths(new Date(), 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    case "thisQuarter":
      startDate = startOfQuarter(new Date());
      endDate = endOfQuarter(new Date());
      break;
    case "lastQuarter":
      const lastQuarter = subQuarters(new Date(), 1);
      startDate = startOfQuarter(lastQuarter);
      endDate = endOfQuarter(lastQuarter);
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

  // Calculate historical trends based on period type
  const trends: MonthlyTrend[] = [];
  let trendsCount = 6; // Default for monthly
  let trendLabel = "month";
  
  switch (period) {
    case "today":
    case "yesterday":
      trendsCount = 7;
      trendLabel = "day";
      break;
    case "thisWeek":
    case "lastWeek":
      trendsCount = 8;
      trendLabel = "week";
      break;
    case "thisMonth":
    case "lastMonth":
      trendsCount = 6;
      trendLabel = "month";
      break;
    case "thisQuarter":
    case "lastQuarter":
      trendsCount = 4;
      trendLabel = "quarter";
      break;
    case "thisYear":
    case "lastYear":
      trendsCount = 5;
      trendLabel = "year";
      break;
  }

  for (let i = trendsCount - 1; i >= 0; i--) {
    let periodDate: Date;
    let periodStart: Date;
    let periodEnd: Date;
    let periodFormat: string;

    switch (trendLabel) {
      case "day":
        periodDate = subDays(new Date(), i);
        periodStart = startOfDay(periodDate);
        periodEnd = endOfDay(periodDate);
        periodFormat = "MMM dd";
        break;
      case "week":
        periodDate = subWeeks(new Date(), i);
        periodStart = startOfWeek(periodDate);
        periodEnd = endOfWeek(periodDate);
        periodFormat = "'Week of' MMM dd";
        break;
      case "quarter":
        periodDate = subQuarters(new Date(), i);
        periodStart = startOfQuarter(periodDate);
        periodEnd = endOfQuarter(periodDate);
        periodFormat = "QQQ yyyy";
        break;
      case "year":
        periodDate = subYears(new Date(), i);
        periodStart = startOfYear(periodDate);
        periodEnd = endOfYear(periodDate);
        periodFormat = "yyyy";
        break;
      default: // month
        periodDate = subMonths(new Date(), i);
        periodStart = startOfMonth(periodDate);
        periodEnd = endOfMonth(periodDate);
        periodFormat = "MMM yyyy";
    }

    const periodPayments = await db.payment.findMany({
      where: {
        paidAt: { gte: periodStart, lte: periodEnd },
        status: "COMPLETED",
      },
    });

    const periodDeposits = await db.securityDeposit.findMany({
      where: {
        paidAt: { gte: periodStart, lte: periodEnd },
        status: "PAID",
      },
    });

    const periodBookings = await db.booking.findMany({
      where: {
        createdAt: { gte: periodStart, lte: periodEnd },
        status: { not: "CANCELLED" },
      },
    });

    trends.push({
      month: format(periodDate, periodFormat),
      revenue: periodPayments.reduce((sum, p) => sum + p.amount, 0),
      payments: periodPayments.length,
      securityDeposits: periodDeposits.reduce((sum, d) => sum + d.amount, 0),
      bookings: periodBookings.length,
    });
  }

  return json({
    user,
    revenueData,
    guestBalances: guestBalances.sort((a, b) => b.totalPaid - a.totalPaid),
    trends,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    trendLabel,
  });
}

export default function Reports() {
  const { user, revenueData, guestBalances, trends, period, trendLabel } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePeriodChange = (value: string | null) => {
    if (value) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("period", value);
      setSearchParams(newParams);
    }
  };

  const handleExport = (format: 'csv' | 'excel') => {
    const exportUrl = `/api/reports/export?period=${period}&format=${format}`;
    window.open(exportUrl, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "thisWeek": return "This Week";
      case "lastWeek": return "Last Week";
      case "thisMonth": return "This Month";
      case "lastMonth": return "Last Month";
      case "thisQuarter": return "This Quarter";
      case "lastQuarter": return "Last Quarter";
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
                { group: "Daily", items: [
                  { value: "today", label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                ]},
                { group: "Weekly", items: [
                  { value: "thisWeek", label: "This Week" },
                  { value: "lastWeek", label: "Last Week" },
                ]},
                { group: "Monthly", items: [
                  { value: "thisMonth", label: "This Month" },
                  { value: "lastMonth", label: "Last Month" },
                ]},
                { group: "Quarterly", items: [
                  { value: "thisQuarter", label: "This Quarter" },
                  { value: "lastQuarter", label: "Last Quarter" },
                ]},
                { group: "Yearly", items: [
                  { value: "thisYear", label: "This Year" },
                  { value: "lastYear", label: "Last Year" },
                ]},
              ]}
              leftSection={<IconCalendar size={16} />}
            />
            <Button.Group>
              <Button
                leftSection={<IconFileSpreadsheet size={16} />}
                variant="light"
                onClick={() => handleExport('excel')}
              >
                Export Excel
              </Button>
              <Button
                leftSection={<IconFileExport size={16} />}
                variant="light"
                onClick={() => handleExport('csv')}
              >
                Export CSV
              </Button>
            </Button.Group>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="light"
              onClick={() => window.print()}
            >
              Print Report
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
            Generated at: {format(new Date(), "MMM dd, yyyy 'at' HH:mm")}
          </Text>
        </Alert>

        {/* Quick Stats Bar */}
        <Grid>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Paper p="md" withBorder ta="center">
              <Text size="xl" fw={700} c="green">₵{revenueData.totalRevenue.toLocaleString()}</Text>
              <Text size="sm" c="dimmed">Total Revenue</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Paper p="md" withBorder ta="center">
              <Text size="xl" fw={700} c="blue">{revenueData.totalBookings}</Text>
              <Text size="sm" c="dimmed">Total Bookings</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Paper p="md" withBorder ta="center">
              <Text size="xl" fw={700} c="orange">₵{revenueData.averageBookingValue.toLocaleString()}</Text>
              <Text size="sm" c="dimmed">Avg Booking Value</Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Paper p="md" withBorder ta="center">
              <Text size="xl" fw={700} c="violet">
                {((revenueData.totalPayments / (revenueData.totalPayments + guestBalances.reduce((sum, guest) => sum + guest.outstandingBalance, 0))) * 100).toFixed(1)}%
              </Text>
              <Text size="sm" c="dimmed">Collection Rate</Text>
            </Paper>
          </Grid.Col>
        </Grid>

        <Tabs defaultValue="overview" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="revenue" leftSection={<IconCurrencyDollar size={16} />}>
              Revenue Details
            </Tabs.Tab>
            <Tabs.Tab value="guests" leftSection={<IconUsers size={16} />}>
              Tenant Balances
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
                    size="xl"
                    color="green"
                  />
                  <Text size="sm" c="dimmed" mt="xs">
                    {formatCurrency(revenueData.totalRevenue)} / {formatCurrency(10000)} target - Progress towards revenue target
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
                <Title order={3}>Tenant Financial Summary</Title>
                <Text size="sm" c="dimmed">
                  {guestBalances.length} guests with financial activity
                </Text>
              </Group>

              <Table.ScrollContainer minWidth={800}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tenant</Table.Th>
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
              </Table.ScrollContainer>

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
              <Title order={3} mb="md">Historical {trendLabel === "month" ? "Monthly" : trendLabel === "quarter" ? "Quarterly" : trendLabel === "year" ? "Annual" : trendLabel === "week" ? "Weekly" : "Daily"} Trends</Title>
              <Table.ScrollContainer minWidth={800}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Period</Table.Th>
                      <Table.Th>Revenue</Table.Th>
                      <Table.Th>Payments</Table.Th>
                      <Table.Th>Security Deposits</Table.Th>
                      <Table.Th>Bookings</Table.Th>
                      <Table.Th>Trend</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {trends.map((trend: any, index: number) => {
                    const prevRevenue = index > 0 ? trends[index - 1].revenue : trend.revenue;
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
              </Table.ScrollContainer>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </DashboardLayout>
  );
}
