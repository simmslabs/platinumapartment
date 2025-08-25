import { useState, useEffect } from "react";
import { Grid, Text, Badge, Button, Group, Stack, Title, ActionIcon, Tooltip } from "@mantine/core";
import { IconClock, IconUsers, IconBed, IconAlertTriangle, IconPhone, IconMail, IconRefresh } from "@tabler/icons-react";
import { format, differenceInHours, isPast } from "date-fns";

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface Room {
  id: string;
  number: string;
  block: string;
}

interface Booking {
  id: string;
  checkIn: Date;
  checkOut: Date;
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  user: Guest;
  room: Room;
}

interface MonitoringStats {
  overdueCheckouts: number;
  upcomingCheckouts: number;
  todayCheckins: number;
  totalActiveGuests: number;
}

interface MonitoringDashboardProps {
  bookings: Booking[];
  stats: MonitoringStats;
  onRefresh?: () => void;
}

export function MonitoringDashboard({ bookings, stats, onRefresh }: MonitoringDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh?.();
    setTimeout(() => setLoading(false), 1000);
  };

  // Filter bookings
  const overdueCheckouts = bookings.filter(booking => 
    booking.status === "CHECKED_IN" && isPast(booking.checkOut)
  );

  const upcomingCheckouts = bookings.filter(booking => {
    const hoursUntilCheckout = differenceInHours(booking.checkOut, currentTime);
    return booking.status === "CHECKED_IN" && 
           hoursUntilCheckout > 0 && 
           hoursUntilCheckout <= 24;
  });

  const todayCheckins = bookings.filter(booking => {
    const today = new Date();
    const checkInDate = new Date(booking.checkIn);
    return booking.status === "CONFIRMED" &&
           checkInDate.toDateString() === today.toDateString();
  });

  const getTimeDifference = (date: Date) => {
    const hours = differenceInHours(currentTime, date);
    if (hours > 24) {
      return `${Math.floor(hours / 24)} days overdue`;
    }
    return `${hours} hours overdue`;
  };

  const getTimeUntil = (date: Date) => {
    const hours = differenceInHours(date, currentTime);
    if (hours > 24) {
      return `${Math.floor(hours / 24)} days`;
    }
    return `${hours} hours`;
  };

  return (
    <div className="monitoring-dashboard">
      {/* Header */}
      <div className="glass-card mb-6">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1} className="text-3xl font-bold text-primary mb-2">
              Monitoring Dashboard
            </Title>
            <Text className="text-neutral">
              Real-time apartment management overview • Last updated: {format(currentTime, 'HH:mm')}
            </Text>
          </div>
          <Tooltip label="Refresh data">
            <ActionIcon 
              size="lg" 
              variant="subtle" 
              onClick={handleRefresh}
              loading={loading}
              className="btn-primary"
            >
              <IconRefresh size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {/* Statistics Grid */}
      <Grid className="mb-8">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <div className="stats-card card-overdue fade-in">
            <div className="stats-number text-error">{stats.overdueCheckouts}</div>
            <div className="stats-label">Overdue Checkouts</div>
            <Badge color="red" variant="light" size="sm" className="mt-2">
              Requires Action
            </Badge>
          </div>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <div className="stats-card card-warning fade-in">
            <div className="stats-number text-warning">{stats.upcomingCheckouts}</div>
            <div className="stats-label">Upcoming Checkouts</div>
            <Badge color="orange" variant="light" size="sm" className="mt-2">
              Next 24 Hours
            </Badge>
          </div>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <div className="stats-card card-success fade-in">
            <div className="stats-number text-success">{stats.todayCheckins}</div>
            <div className="stats-label">Today&apos;s Check-ins</div>
            <Badge color="green" variant="light" size="sm" className="mt-2">
              Expected Today
            </Badge>
          </div>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <div className="stats-card card-info fade-in">
            <div className="stats-number text-primary">{stats.totalActiveGuests}</div>
            <div className="stats-label">Active Guests</div>
            <Badge color="blue" variant="light" size="sm" className="mt-2">
              Currently Staying
            </Badge>
          </div>
        </Grid.Col>
      </Grid>

      {/* Content Grid */}
      <Grid>
        {/* Overdue Checkouts */}
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <div className="glass-card card-overdue">
            <Group justify="space-between" align="center" className="mb-4">
              <Title order={2} className="text-xl font-semibold text-error">
                <IconAlertTriangle size={24} className="inline mr-2" />
                Overdue Checkouts
              </Title>
              <Badge color="red" size="lg">{overdueCheckouts.length}</Badge>
            </Group>
            
            {overdueCheckouts.length === 0 ? (
              <div className="text-center p-8">
                <Text className="text-neutral-500 text-lg">🎉 No overdue checkouts</Text>
                <Text className="text-neutral-400 text-sm mt-2">All guests are on schedule</Text>
              </div>
            ) : (
              <Stack gap="md">
                {overdueCheckouts.map((booking) => (
                  <div key={booking.id} className="glass p-4 rounded-lg border-l-4 border-error-500 bounce-in">
                    <Group justify="space-between" align="start">
                      <div className="flex-1">
                        <Text className="font-semibold text-lg mb-1">
                          {booking.user.firstName} {booking.user.lastName}
                        </Text>
                        <Group gap="md" className="mb-2">
                          <Badge variant="light" color="blue" leftSection={<IconBed size={12} />}>
                            Room {booking.room.number}
                          </Badge>
                          <Badge variant="light" color="gray" leftSection={<IconClock size={12} />}>
                            {getTimeDifference(booking.checkOut)}
                          </Badge>
                        </Group>
                        <Text className="text-sm text-neutral-600">
                          Expected checkout: {format(booking.checkOut, 'MMM dd, yyyy HH:mm')}
                        </Text>
                      </div>
                      <Group gap="xs">
                        {booking.user.phone && (
                          <Tooltip label="Call guest">
                            <ActionIcon variant="light" color="blue" size="sm">
                              <IconPhone size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Send email">
                          <ActionIcon variant="light" color="gray" size="sm">
                            <IconMail size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Grid.Col>

        {/* Upcoming Checkouts */}
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <div className="glass-card card-warning">
            <Group justify="space-between" align="center" className="mb-4">
              <Title order={2} className="text-xl font-semibold text-warning">
                <IconClock size={24} className="inline mr-2" />
                Upcoming Checkouts
              </Title>
              <Badge color="orange" size="lg">{upcomingCheckouts.length}</Badge>
            </Group>
            
            {upcomingCheckouts.length === 0 ? (
              <div className="text-center p-8">
                <Text className="text-neutral-500 text-lg">📅 No checkouts today</Text>
                <Text className="text-neutral-400 text-sm mt-2">Quiet day ahead</Text>
              </div>
            ) : (
              <Stack gap="md">
                {upcomingCheckouts.map((booking) => (
                  <div key={booking.id} className="glass p-4 rounded-lg border-l-4 border-warning-500 fade-in">
                    <Group justify="space-between" align="start">
                      <div className="flex-1">
                        <Text className="font-semibold text-lg mb-1">
                          {booking.user.firstName} {booking.user.lastName}
                        </Text>
                        <Group gap="md" className="mb-2">
                          <Badge variant="light" color="blue" leftSection={<IconBed size={12} />}>
                            Room {booking.room.number}
                          </Badge>
                          <Badge variant="light" color="orange" leftSection={<IconClock size={12} />}>
                            {getTimeUntil(booking.checkOut)} remaining
                          </Badge>
                        </Group>
                        <Text className="text-sm text-neutral-600">
                          Checkout: {format(booking.checkOut, 'MMM dd, yyyy HH:mm')}
                        </Text>
                      </div>
                      <Group gap="xs">
                        {booking.user.phone && (
                          <Tooltip label="Send reminder">
                            <ActionIcon variant="light" color="orange" size="sm">
                              <IconPhone size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Send email">
                          <ActionIcon variant="light" color="gray" size="sm">
                            <IconMail size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Grid.Col>

        {/* Today's Check-ins */}
        <Grid.Col span={{ base: 12 }}>
          <div className="glass-card card-success">
            <Group justify="space-between" align="center" className="mb-4">
              <Title order={2} className="text-xl font-semibold text-success">
                <IconUsers size={24} className="inline mr-2" />
                Today&apos;s Check-ins
              </Title>
              <Badge color="green" size="lg">{todayCheckins.length}</Badge>
            </Group>
            
            {todayCheckins.length === 0 ? (
              <div className="text-center p-8">
                <Text className="text-neutral-500 text-lg">🏨 No check-ins scheduled</Text>
                <Text className="text-neutral-400 text-sm mt-2">All rooms ready for tomorrow</Text>
              </div>
            ) : (
              <Grid>
                {todayCheckins.map((booking) => (
                  <Grid.Col key={booking.id} span={{ base: 12, sm: 6, lg: 4 }}>
                    <div className="glass p-4 rounded-lg border-l-4 border-success-500 slide-in-left">
                      <Text className="font-semibold text-lg mb-2">
                        {booking.user.firstName} {booking.user.lastName}
                      </Text>
                      <Group gap="md" className="mb-3">
                        <Badge variant="light" color="blue" leftSection={<IconBed size={12} />}>
                          Room {booking.room.number}
                        </Badge>
                        <Badge variant="light" color="green">
                          {format(booking.checkIn, 'HH:mm')}
                        </Badge>
                      </Group>
                      <Text className="text-sm text-neutral-600 mb-3">
                        Block: {booking.room.block}
                      </Text>
                      <Group gap="xs" justify="flex-end">
                        <Button size="xs" variant="light" color="green">
                          Check In
                        </Button>
                        {booking.user.phone && (
                          <ActionIcon variant="light" color="blue" size="sm">
                            <IconPhone size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </div>
                  </Grid.Col>
                ))}
              </Grid>
            )}
          </div>
        </Grid.Col>
      </Grid>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="glass-card p-6 text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <Text>Refreshing data...</Text>
          </div>
        </div>
      )}
    </div>
  );
}
