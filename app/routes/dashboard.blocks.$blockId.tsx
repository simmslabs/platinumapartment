import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import {
  Title,
  Card,
  Text,
  Badge,
  Button,
  Stack,
  Group,
  ActionIcon,
  Table,
  Avatar,
  ThemeIcon,
  Container,
  Grid,
  Paper,
  Progress,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBuilding,
  IconUsers,
  IconCurrencyDollar,
  IconBed,
} from "@tabler/icons-react";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { format } from "date-fns";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const blockName = data?.block?.name || "Unknown";
  return [
    { title: `Block ${blockName} - Apartment Management` },
    { name: "description", content: `View details and occupancy for Block ${blockName}` },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const { blockId } = params;

  if (!blockId) {
    throw new Response("Block ID is required", { status: 400 });
  }

  // Get block details with rooms and their current bookings
  const block = await db.block.findUnique({
    where: { id: blockId },
    include: {
      rooms: {
        include: {
          type: {
            select: {
              displayName: true,
              name: true,
            },
          },
          bookings: {
            where: {
              OR: [
                { status: "CHECKED_IN" },
                {
                  AND: [
                    { status: "CONFIRMED" },
                    { checkIn: { lte: new Date() } },
                    { checkOut: { gte: new Date() } },
                  ],
                },
              ],
            },
            include: {
              user: true,
              payment: true,
            },
            orderBy: {
              checkIn: "desc",
            },
            take: 1, // Get only the current/active booking
          },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!block) {
    throw new Response("Block not found", { status: 404 });
  }

  // Calculate block statistics
  const totalRooms = block.rooms.length;
  const occupiedRooms = block.rooms.filter(room => 
    room.status === "OCCUPIED" || 
    (room.bookings.length > 0 && room.bookings[0].status === "CHECKED_IN")
  ).length;
  const availableRooms = block.rooms.filter(room => room.status === "AVAILABLE").length;
  const maintenanceRooms = block.rooms.filter(room => 
    room.status === "MAINTENANCE" || room.status === "OUT_OF_ORDER"
  ).length;

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  // Get all historical bookings for revenue calculation
  const allBookings = await db.booking.findMany({
    where: {
      room: {
        blockId: blockId,
      },
      payment: {
        status: "COMPLETED",
      },
    },
    include: {
      user: true,
      room: true,
      payment: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalRevenue = allBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

  // Room type distribution
  const roomTypes = block.rooms.reduce((acc, room) => {
    const typeName = room.type.displayName;
    acc[typeName] = (acc[typeName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Current occupants (rooms with active bookings)
  const currentOccupants = block.rooms
    .filter(room => room.bookings.length > 0)
    .map(room => ({
      room,
      guest: room.bookings[0],
    }));

  return json({
    user,
    block,
    statistics: {
      totalRooms,
      occupiedRooms,
      availableRooms,
      maintenanceRooms,
      occupancyRate,
      totalRevenue,
      roomTypes,
    },
    currentOccupants,
    allBookings: allBookings.slice(0, 10), // Show last 10 bookings
  });
}

export default function BlockDetails() {
  const { user, block, statistics, currentOccupants, allBookings } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "green";
      case "OCCUPIED":
        return "blue";
      case "MAINTENANCE":
        return "orange";
      case "OUT_OF_ORDER":
        return "red";
      default:
        return "gray";
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "blue";
      case "CHECKED_IN":
        return "green";
      case "CHECKED_OUT":
        return "gray";
      case "CANCELLED":
        return "red";
      default:
        return "yellow";
    }
  };

  const formatPriceWithPeriod = (price: number, period: string) => {
    const label = period?.toLowerCase() || "night";
    return `₵${price.toLocaleString()}/${label}`;
  };

  return (
    <DashboardLayout user={user}>
      <Container size="xl">
        <Group justify="space-between" mb="xl">
          <Group>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => navigate("/dashboard/rooms")}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={2}>Block {block.name}</Title>
              <Text c="dimmed">
                {block.description || `Block ${block.name} Details`}
              </Text>
            </div>
          </Group>
          <Group>
            <Badge size="lg" variant="light" color="blue">
              {statistics.totalRooms} Total Rooms
            </Badge>
            <Badge size="lg" color={statistics.occupancyRate > 80 ? "red" : statistics.occupancyRate > 60 ? "orange" : "green"}>
              {statistics.occupancyRate.toFixed(1)}% Occupied
            </Badge>
          </Group>
        </Group>

        {/* Statistics Cards */}
        <Grid gutter="md" mb="xl">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total Rooms</Text>
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconBed size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl">{statistics.totalRooms}</Text>
              <Text size="xs" c="dimmed">In this block</Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Occupied</Text>
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconUsers size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl" c="green">{statistics.occupiedRooms}</Text>
              <Progress value={statistics.occupancyRate} size="xs" mt="xs" color="green" />
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Available</Text>
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconBuilding size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl" c="blue">{statistics.availableRooms}</Text>
              <Text size="xs" c="dimmed">Ready for guests</Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total Revenue</Text>
                <ThemeIcon size="sm" variant="light" color="orange">
                  <IconCurrencyDollar size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={600} size="xl" c="orange">₵{statistics.totalRevenue.toLocaleString()}</Text>
              <Text size="xs" c="dimmed">All time</Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Room Type Distribution */}
        <Card shadow="sm" p="lg" mb="xl">
          <Title order={4} mb="md">Room Type Distribution</Title>
          <Grid>
            {Object.entries(statistics.roomTypes).map(([type, count]) => (
              <Grid.Col key={type} span={{ base: 6, sm: 4, md: 3 }}>
                <Paper p="md" withBorder>
                  <Text size="sm" c="dimmed" mb={4}>{type.replace("_", " ")}</Text>
                  <Text fw={600} size="lg">{count}</Text>
                  <Progress
                    value={(count / statistics.totalRooms) * 100}
                    size="xs"
                    mt="xs"
                    color="blue"
                  />
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Card>

        <Grid gutter="md">
          {/* Current Occupants */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>Current Occupants</Title>
                <Badge variant="light">{currentOccupants.length} occupied</Badge>
              </Group>
              
              {currentOccupants.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Room</Table.Th>
                      <Table.Th>Guest</Table.Th>
                      <Table.Th>Check In</Table.Th>
                      <Table.Th>Check Out</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {currentOccupants.map(({ room, guest }) => (
                      <Table.Tr key={room.id}>
                        <Table.Td>
                          <Group>
                            <ThemeIcon size="sm" variant="light">
                              <IconBed size={14} />
                            </ThemeIcon>
                            <div>
                              <Text fw={500}>Room {room.number}</Text>
                              <Text size="xs" c="dimmed">{room.type.displayName}</Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group>
                            <Avatar size="sm" />
                            <div>
                              <Text size="sm" fw={500}>
                                {guest.user.firstName} {guest.user.lastName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {guest.user.email}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{format(new Date(guest.checkIn), "MMM dd, yyyy")}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{format(new Date(guest.checkOut), "MMM dd, yyyy")}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" color={getBookingStatusColor(guest.status)}>
                            {guest.status.replace("_", " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500} size="sm">₵{guest.totalAmount.toLocaleString()}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  No current occupants
                </Text>
              )}
            </Card>
          </Grid.Col>

          {/* All Rooms Status */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card shadow="sm" p="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>All Rooms</Title>
                <Button 
                  component={Link} 
                  to="/dashboard/rooms" 
                  variant="light" 
                  size="xs"
                >
                  Manage Rooms
                </Button>
              </Group>
              
              <Stack gap="sm">
                {block.rooms.map((room) => (
                  <Paper key={room.id} p="sm" withBorder>
                    <Group justify="space-between">
                      <Group>
                        <ThemeIcon size="sm" variant="light" color={getStatusColor(room.status)}>
                          <IconBed size={14} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={500}>Room {room.number}</Text>
                          <Text size="xs" c="dimmed">{room.type.displayName}</Text>
                        </div>
                      </Group>
                      <Stack gap={2} align="flex-end">
                        <Badge size="xs" color={getStatusColor(room.status)}>
                          {room.status.replace("_", " ")}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {formatPriceWithPeriod(room.pricePerNight, room.pricingPeriod || "NIGHT")}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Recent Bookings */}
        <Card shadow="sm" p="lg" mt="xl">
          <Group justify="space-between" mb="md">
            <Title order={4}>Recent Bookings</Title>
            <Button 
              component={Link} 
              to="/dashboard/bookings" 
              variant="light" 
              size="xs"
            >
              View All Bookings
            </Button>
          </Group>
          
          {allBookings.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Guest</Table.Th>
                  <Table.Th>Room</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {allBookings.map((booking) => (
                  <Table.Tr key={booking.id}>
                    <Table.Td>
                      <Text size="sm">{format(new Date(booking.createdAt), "MMM dd, yyyy")}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group>
                        <Avatar size="sm" />
                        <div>
                          <Text size="sm" fw={500}>
                            {booking.user.firstName} {booking.user.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {booking.user.email}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>Room {booking.room.number}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {format(new Date(booking.checkIn), "MMM dd")} - {format(new Date(booking.checkOut), "MMM dd")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500} size="sm">₵{booking.totalAmount.toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={getBookingStatusColor(booking.status)}>
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No bookings found for this block
            </Text>
          )}
        </Card>
      </Container>
    </DashboardLayout>
  );
}
