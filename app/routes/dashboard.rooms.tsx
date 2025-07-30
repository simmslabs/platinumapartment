import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Title,
  Grid,
  Card,
  Text,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Alert,
  Paper,
  Divider,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconFilter, IconSearch } from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Room } from "@prisma/client";
import { useState, useMemo } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Rooms - Apartment Management" },
    { name: "description", content: "Manage apartment units" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const rooms = await db.room.findMany({
    orderBy: { number: "asc" },
  });

  return json({ user, rooms });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const number = formData.get("number") as string;
      const type = formData.get("type") as any;
      const floor = parseInt(formData.get("floor") as string);
      const capacity = parseInt(formData.get("capacity") as string);
      const pricePerNight = parseFloat(formData.get("pricePerNight") as string);
      const description = formData.get("description") as string;

      if (!number || !type || !floor || !capacity || !pricePerNight) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }

      await db.room.create({
        data: {
          number,
          type,
          floor,
          capacity,
          pricePerNight,
          description: description || null,
        },
      });

      return json({ success: "Room created successfully" });
    }

    if (intent === "update-status") {
      const roomId = formData.get("roomId") as string;
      const status = formData.get("status") as any;

      await db.room.update({
        where: { id: roomId },
        data: { status },
      });

      return json({ success: "Room status updated successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Room action error:", error);
    if (error.code === "P2002") {
      return json({ error: "Room number already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Rooms() {
  const { user, rooms } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [capacityFilter, setCapacityFilter] = useState<string | null>(null);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const floors = [...new Set(rooms.map(room => room.floor))].sort((a, b) => a - b);
    const capacities = [...new Set(rooms.map(room => room.capacity))].sort((a, b) => a - b);
    
    return {
      floors: floors.map(floor => ({ value: floor.toString(), label: `Floor ${floor}` })),
      capacities: capacities.map(capacity => ({ value: capacity.toString(), label: `${capacity} guests` })),
    };
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          room.number.toLowerCase().includes(query) ||
          room.type.toLowerCase().includes(query) ||
          room.description?.toLowerCase().includes(query) ||
          room.status.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter && room.status !== statusFilter) return false;

      // Type filter  
      if (typeFilter && room.type !== typeFilter) return false;

      // Floor filter
      if (floorFilter && room.floor.toString() !== floorFilter) return false;

      // Capacity filter
      if (capacityFilter && room.capacity.toString() !== capacityFilter) return false;

      return true;
    });
  }, [rooms, searchQuery, statusFilter, typeFilter, floorFilter, capacityFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setTypeFilter(null);
    setFloorFilter(null);
    setCapacityFilter(null);
  };

  const hasActiveFilters = searchQuery || statusFilter || typeFilter || floorFilter || capacityFilter;

  const getStatusColor = (status: Room["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "green";
      case "OCCUPIED":
        return "blue";
      case "MAINTENANCE":
        return "yellow";
      case "OUT_OF_ORDER":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Rooms Management</Title>
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Add Room
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

        {/* Filters Section */}
        <Paper p="md" withBorder>
          <Group mb="md">
            <IconFilter size={20} />
            <Text fw={500}>Filters</Text>
            {hasActiveFilters && (
              <Button size="compact-sm" variant="subtle" onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </Group>
          
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }}>
              <TextInput
                placeholder="Search rooms..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }}>
              <Select
                placeholder="All Statuses"
                data={[
                  { value: "AVAILABLE", label: "Available" },
                  { value: "OCCUPIED", label: "Occupied" },
                  { value: "MAINTENANCE", label: "Maintenance" },
                  { value: "OUT_OF_ORDER", label: "Out of Order" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                clearable
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }}>
              <Select
                placeholder="All Types"
                data={[
                  { value: "SINGLE", label: "Single" },
                  { value: "DOUBLE", label: "Double" },
                  { value: "SUITE", label: "Suite" },
                  { value: "DELUXE", label: "Deluxe" },
                  { value: "PRESIDENTIAL", label: "Presidential" },
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
                clearable
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }}>
              <Select
                placeholder="All Floors"
                data={filterOptions.floors}
                value={floorFilter}
                onChange={setFloorFilter}
                clearable
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }}>
              <Select
                placeholder="All Capacities"
                data={filterOptions.capacities}
                value={capacityFilter}
                onChange={setCapacityFilter}
                clearable
              />
            </Grid.Col>
          </Grid>
          
          <Divider my="md" />
          
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredRooms.length} of {rooms.length} rooms
            </Text>
            {hasActiveFilters && (
              <Badge variant="light" color="blue">
                {[searchQuery && "Search", statusFilter && "Status", typeFilter && "Type", 
                  floorFilter && "Floor", capacityFilter && "Capacity"]
                  .filter(Boolean).length} filter(s) active
              </Badge>
            )}
          </Group>
        </Paper>

        <Grid>
          {filteredRooms.length === 0 ? (
            <Grid.Col span={12}>
              <Paper p="xl" withBorder>
                <Stack align="center">
                  <IconInfoCircle size={48} color="gray" />
                  <Text size="lg" c="dimmed">
                    {hasActiveFilters ? "No rooms match your filters" : "No rooms found"}
                  </Text>
                  {hasActiveFilters && (
                    <Button variant="light" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>
          ) : (
            filteredRooms.map((room) => (
            <Grid.Col key={room.id} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card shadow="sm" p="lg" h="100%">
                <Group justify="space-between" mb="md">
                  <Text fw={600} size="lg">
                    Room {room.number}
                  </Text>
                  <Badge color={getStatusColor(room.status)} size="sm">
                    {room.status.replace("_", " ")}
                  </Badge>
                </Group>

                <Stack gap="xs">
                  <Text size="sm">
                    <strong>Type:</strong> {room.type.replace("_", " ")}
                  </Text>
                  <Text size="sm">
                    <strong>Floor:</strong> {room.floor}
                  </Text>
                  <Text size="sm">
                    <strong>Capacity:</strong> {room.capacity} guests
                  </Text>
                  <Text size="sm">
                    <strong>Price:</strong> ${room.pricePerNight}/night
                  </Text>
                  {room.description && (
                    <Text size="sm" c="dimmed">
                      {room.description}
                    </Text>
                  )}
                </Stack>

                {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                  <Form method="post" style={{ marginTop: "1rem" }}>
                    <input type="hidden" name="intent" value="update-status" />
                    <input type="hidden" name="roomId" value={room.id} />
                    <Select
                      name="status"
                      data={[
                        { value: "AVAILABLE", label: "Available" },
                        { value: "OCCUPIED", label: "Occupied" },
                        { value: "MAINTENANCE", label: "Maintenance" },
                        { value: "OUT_OF_ORDER", label: "Out of Order" },
                      ]}
                      defaultValue={room.status}
                      onChange={(value) => {
                        if (value) {
                          const form = new FormData();
                          form.append("intent", "update-status");
                          form.append("roomId", room.id);
                          form.append("status", value);
                          fetch("/dashboard/rooms", {
                            method: "POST",
                            body: form,
                          }).then(() => window.location.reload());
                        }
                      }}
                    />
                  </Form>
                )}
              </Card>
            </Grid.Col>
          )))}
        </Grid>

        <Modal opened={opened} onClose={close} title="Add New Room" size="lg">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Stack>
              <TextInput
                label="Room Number"
                placeholder="101"
                name="number"
                required
              />

              <Select
                label="Room Type"
                placeholder="Select type"
                name="type"
                data={[
                  { value: "SINGLE", label: "Single" },
                  { value: "DOUBLE", label: "Double" },
                  { value: "SUITE", label: "Suite" },
                  { value: "DELUXE", label: "Deluxe" },
                  { value: "PRESIDENTIAL", label: "Presidential" },
                ]}
                required
              />

              <Group grow>
                <NumberInput
                  label="Floor"
                  placeholder="1"
                  name="floor"
                  min={1}
                  required
                />
                <NumberInput
                  label="Capacity"
                  placeholder="2"
                  name="capacity"
                  min={1}
                  required
                />
              </Group>

              <NumberInput
                label="Price per Night"
                placeholder="100"
                name="pricePerNight"
                min={0}
                prefix="$"
                decimalScale={2}
                required
              />

              <Textarea
                label="Description"
                placeholder="Room description..."
                name="description"
                rows={3}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" onClick={close}>
                  Add Room
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
