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
import { IconPlus, IconEdit, IconInfoCircle, IconFilter, IconSearch, IconTrash, IconBuilding } from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Room } from "@prisma/client";
import { useState, useMemo, useEffect } from "react";

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
    include: {
      blockRelation: true,
    },
    orderBy: { number: "asc" },
  });

  const blocks = await db.block.findMany({
    orderBy: { name: "asc" },
  });

  return json({ user, rooms, blocks });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const number = formData.get("number") as string;
      const type = formData.get("type") as any;
      const block = formData.get("block") as string;
      const floorStr = formData.get("floor") as string;
      const capacityStr = formData.get("capacity") as string;
      const pricePerNightStr = formData.get("pricePerNight") as string;
      const description = formData.get("description") as string;

      // Validate required fields
      if (!number || !type || !block || !floorStr || !capacityStr || !pricePerNightStr) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }

      // Parse numeric values
      const floor = parseInt(floorStr);
      const capacity = parseInt(capacityStr);
      const pricePerNight = parseFloat(pricePerNightStr);

      // Validate parsed numeric values
      if (isNaN(floor) || floor <= 0) {
        return json({ error: "Floor must be a valid positive number" }, { status: 400 });
      }

      if (isNaN(capacity) || capacity <= 0) {
        return json({ error: "Capacity must be a valid positive number" }, { status: 400 });
      }

      if (isNaN(pricePerNight) || pricePerNight <= 0) {
        return json({ error: "Price per night must be a valid positive number" }, { status: 400 });
      }

      // Find or create the block
      let blockRecord = await db.block.findFirst({
        where: { name: block }
      });

      if (!blockRecord) {
        // Create new block if it doesn't exist
        blockRecord = await db.block.create({
          data: {
            name: block,
            description: `Block ${block}`,
          }
        });
      }

      // Check if room number already exists in this block
      const existingRoom = await db.room.findFirst({
        where: {
          number: number,
          blockId: blockRecord.id
        }
      });

      if (existingRoom) {
        return json({ error: `Room ${number} already exists in Block ${block}` }, { status: 400 });
      }

      await db.room.create({
        data: {
          number,
          type,
          blockId: blockRecord.id,
          block, // Keep for backward compatibility
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

    if (intent === "update-block") {
      const oldBlock = formData.get("oldBlock") as string;
      const newBlock = formData.get("newBlock") as string;

      if (!oldBlock || !newBlock) {
        return json({ error: "Block names are required" }, { status: 400 });
      }

      if (oldBlock === newBlock) {
        return json({ error: "New block name must be different" }, { status: 400 });
      }

      // Update all rooms in the old block to the new block
      const updateResult = await db.room.updateMany({
        where: { block: oldBlock },
        data: { block: newBlock },
      });

      if (updateResult.count === 0) {
        return json({ error: `No rooms found in block "${oldBlock}"` }, { status: 400 });
      }

      return json({ success: `Block "${oldBlock}" renamed to "${newBlock}" successfully. ${updateResult.count} room(s) updated.` });
    }

    if (intent === "delete-block") {
      const blockName = formData.get("blockName") as string;

      if (!blockName) {
        return json({ error: "Block name is required" }, { status: 400 });
      }

      // Check if block has rooms
      const roomsInBlock = await db.room.findMany({
        where: { block: blockName }
      });

      if (roomsInBlock.length > 0) {
        return json({ error: `Cannot delete block "${blockName}" as it contains ${roomsInBlock.length} room(s). Please move or delete the rooms first.` }, { status: 400 });
      }

      return json({ success: `Block "${blockName}" deleted successfully` });
    }

    if (intent === "create-block") {
      const blockName = formData.get("blockName") as string;

      if (!blockName) {
        return json({ error: "Block name is required" }, { status: 400 });
      }

      // Check if block already exists
      const existingBlock = await db.block.findFirst({
        where: { name: blockName }
      });

      if (existingBlock) {
        return json({ error: `Block "${blockName}" already exists` }, { status: 400 });
      }

      await db.block.create({
        data: {
          name: blockName,
          description: `Block ${blockName}`,
        }
      });

      return json({ success: `Block "${blockName}" created successfully. You can now add rooms to this block.` });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Room action error:", error);
    if (error.code === "P2002") {
      // Check which constraint failed
      if (error.meta?.target?.includes('number') && error.meta?.target?.includes('blockId')) {
        return json({ error: "Room number already exists in this block" }, { status: 400 });
      }
      return json({ error: "Room number already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Rooms() {
  const { user, rooms, blocks } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [blockModalOpened, { open: openBlockModal, close: closeBlockModal }] = useDisclosure(false);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<string | null>(null);
  const [creatingBlock, setCreatingBlock] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [blockFilter, setBlockFilter] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [capacityFilter, setCapacityFilter] = useState<string | null>(null);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const blocks = [...new Set(rooms.map(room => room.block))].sort();
    const floors = [...new Set(rooms.map(room => room.floor))].sort((a, b) => a - b);
    const capacities = [...new Set(rooms.map(room => room.capacity))].sort((a, b) => a - b);
    
    return {
      blocks: blocks.map(block => ({ value: block, label: `Block ${block}` })),
      floors: floors.map(floor => ({ value: floor.toString(), label: `Floor ${floor}` })),
      capacities: capacities.map(capacity => ({ value: capacity.toString(), label: `${capacity} guests` })),
    };
  }, [rooms]);

  // Get block statistics
  const blockStats = useMemo(() => {
    return filterOptions.blocks.map(blockOption => {
      const blockRooms = rooms.filter(room => room.block === blockOption.value);
      const available = blockRooms.filter(room => room.status === 'AVAILABLE').length;
      const occupied = blockRooms.filter(room => room.status === 'OCCUPIED').length;
      const maintenance = blockRooms.filter(room => room.status === 'MAINTENANCE').length;
      const outOfOrder = blockRooms.filter(room => room.status === 'OUT_OF_ORDER').length;
      
      return {
        name: blockOption.value,
        total: blockRooms.length,
        available,
        occupied,
        maintenance,
        outOfOrder
      };
    });
  }, [rooms, filterOptions.blocks]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          room.number.toLowerCase().includes(query) ||
          room.type.toLowerCase().includes(query) ||
          room.block.toLowerCase().includes(query) ||
          `${room.block}-${room.number}`.toLowerCase().includes(query) || // Allow searching by "Block-RoomNumber" format
          room.description?.toLowerCase().includes(query) ||
          room.status.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter && room.status !== statusFilter) return false;

      // Type filter  
      if (typeFilter && room.type !== typeFilter) return false;

      // Block filter
      if (blockFilter && room.block !== blockFilter) return false;

      // Floor filter
      if (floorFilter && room.floor.toString() !== floorFilter) return false;

      // Capacity filter
      if (capacityFilter && room.capacity.toString() !== capacityFilter) return false;

      return true;
    });
  }, [rooms, searchQuery, statusFilter, typeFilter, blockFilter, floorFilter, capacityFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setTypeFilter(null);
    setBlockFilter(null);
    setFloorFilter(null);
    setCapacityFilter(null);
  };

  const hasActiveFilters = searchQuery || statusFilter || typeFilter || blockFilter || floorFilter || capacityFilter;

  // Close modals on successful action
  useEffect(() => {
    if (actionData?.success) {
      close();
      closeBlockModal();
      setEditingBlock(null);
      setDeletingBlock(null);
      setCreatingBlock(false);
    }
  }, [actionData?.success, close, closeBlockModal]);

  // Group rooms by blocks for better organization
  const roomsByBlock = useMemo(() => {
    const grouped = filteredRooms.reduce((acc, room) => {
      if (!acc[room.block]) {
        acc[room.block] = [];
      }
      acc[room.block].push(room);
      return acc;
    }, {} as Record<string, typeof filteredRooms>);
    
    // Sort rooms within each block by room number
    Object.keys(grouped).forEach(block => {
      grouped[block].sort((a, b) => a.number.localeCompare(b.number));
    });
    
    return grouped;
  }, [filteredRooms]);

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
          <Group>
            {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
              <>
                <Button 
                  leftSection={<IconBuilding size={16} />} 
                  variant="outline"
                  onClick={openBlockModal}
                >
                  Manage Blocks
                </Button>
                <Button 
                  leftSection={<IconPlus size={16} />} 
                  variant="light"
                  onClick={() => {
                    setCreatingBlock(true);
                    openBlockModal();
                  }}
                >
                  Create Block
                </Button>
                <Button leftSection={<IconPlus size={16} />} onClick={open}>
                  Add Room
                </Button>
              </>
            )}
          </Group>
        </Group>

        {/* Block Management Section */}
        {blockStats.length > 0 && (
          <Paper p="md" withBorder>
            <Group mb="md">
              <IconBuilding size={20} />
              <Text fw={500}>Block Overview</Text>
            </Group>
            <Grid>
              {blockStats.map((block) => (
                <Grid.Col key={block.name} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card p="sm" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Text fw={600}>Block {block.name}</Text>
                      {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                        <Group gap="xs">
                          <Button 
                            size="compact-xs" 
                            variant="subtle"
                            onClick={() => {
                              setEditingBlock(block.name);
                              openBlockModal();
                            }}
                          >
                            <IconEdit size={14} />
                          </Button>
                          <Button 
                            size="compact-xs" 
                            variant="subtle" 
                            color="red"
                            onClick={() => {
                              setDeletingBlock(block.name);
                              openBlockModal();
                            }}
                            disabled={block.total > 0}
                          >
                            <IconTrash size={14} />
                          </Button>
                        </Group>
                      )}
                    </Group>
                    <Stack gap="xs">
                      <Text size="sm"><strong>Total:</strong> {block.total} rooms</Text>
                      <Group gap="xs">
                        <Badge color="green" size="sm">{block.available} Available</Badge>
                        <Badge color="blue" size="sm">{block.occupied} Occupied</Badge>
                      </Group>
                      {(block.maintenance > 0 || block.outOfOrder > 0) && (
                        <Group gap="xs">
                          {block.maintenance > 0 && (
                            <Badge color="yellow" size="sm">{block.maintenance} Maintenance</Badge>
                          )}
                          {block.outOfOrder > 0 && (
                            <Badge color="red" size="sm">{block.outOfOrder} Out of Order</Badge>
                          )}
                        </Group>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          </Paper>
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
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
              <TextInput
                placeholder="Search rooms (try A-101)..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
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
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
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
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
              <Select
                placeholder="All Blocks"
                data={filterOptions.blocks}
                value={blockFilter}
                onChange={setBlockFilter}
                clearable
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
              <Select
                placeholder="All Floors"
                data={filterOptions.floors}
                value={floorFilter}
                onChange={setFloorFilter}
                clearable
              />
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
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
                  blockFilter && "Block", floorFilter && "Floor", capacityFilter && "Capacity"]
                  .filter(Boolean).length} filter(s) active
              </Badge>
            )}
          </Group>
        </Paper>

        {filteredRooms.length === 0 ? (
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
        ) : (
          <Stack gap="xl">
            {Object.entries(roomsByBlock)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([block, blockRooms]) => (
              <div key={block}>
                <Group mb="md">
                  <Title order={3} c="blue">Block {block}</Title>
                  <Badge variant="light" color="blue" size="lg">
                    {blockRooms.length} room{blockRooms.length !== 1 ? 's' : ''}
                  </Badge>
                </Group>
                
                <Grid>
                  {blockRooms.map((room) => (
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
                            <strong>Block:</strong> {room.block}
                          </Text>
                          <Text size="sm">
                            <strong>Floor:</strong> {room.floor}
                          </Text>
                          <Text size="sm">
                            <strong>Capacity:</strong> {room.capacity} guests
                          </Text>
                          <Text size="sm">
                            <strong>Price:</strong> ₵{room.pricePerNight}/night
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
                  ))}
                </Grid>
              </div>
            ))}
          </Stack>
        )}

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

              <Select
                label="Block"
                placeholder="Select existing block or create new one"
                name="block"
                data={blocks.map(block => ({ value: block.name, label: `Block ${block.name}` }))}
                searchable
                creatable
                getCreateLabel={(query) => `Create Block "${query}"`}
                onCreate={(query) => {
                  const item = { value: query, label: `Block ${query}` };
                  return item;
                }}
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

              <TextInput
                label="Price per Night (₵)"
                placeholder="100.00"
                name="pricePerNight"
                type="number"
                min={0}
                step="0.01"
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
                <Button type="submit">
                  Add Room
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>

        {/* Block Management Modal */}
        <Modal 
          opened={blockModalOpened} 
          onClose={() => {
            closeBlockModal();
            setEditingBlock(null);
            setDeletingBlock(null);
            setCreatingBlock(false);
          }} 
          title={
            creatingBlock ? "Create New Block" :
            editingBlock ? `Edit Block "${editingBlock}"` : 
            deletingBlock ? `Delete Block "${deletingBlock}"` : 
            "Manage Blocks"
          } 
          size="md"
        >
          {creatingBlock && (
            <Form method="post">
              <input type="hidden" name="intent" value="create-block" />
              <Stack>
                <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                  Create a new block that can contain multiple rooms. You can add rooms to this block later.
                </Alert>
                
                <TextInput
                  label="Block Name"
                  placeholder="Enter block name (e.g., A, B, East Wing, etc.)"
                  name="blockName"
                  required
                />

                <Group justify="flex-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      closeBlockModal();
                      setCreatingBlock(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    leftSection={<IconPlus size={16} />}
                  >
                    Create Block
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}

          {editingBlock && (
            <Form method="post">
              <input type="hidden" name="intent" value="update-block" />
              <input type="hidden" name="oldBlock" value={editingBlock} />
              <Stack>
                <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                  Renaming a block will update all rooms currently in this block.
                </Alert>
                
                <TextInput
                  label="Current Block Name"
                  value={editingBlock}
                  disabled
                />

                <TextInput
                  label="New Block Name"
                  placeholder="Enter new block name"
                  name="newBlock"
                  required
                />

                <Group justify="flex-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      closeBlockModal();
                      setEditingBlock(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                  >
                    Rename Block
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}

          {deletingBlock && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete-block" />
              <input type="hidden" name="blockName" value={deletingBlock} />
              <Stack>
                <Alert color="red" icon={<IconInfoCircle size={16} />}>
                  Are you sure you want to delete block "{deletingBlock}"? This action cannot be undone.
                </Alert>
                
                {blockStats.find(b => b.name === deletingBlock)?.total === 0 ? (
                  <Text size="sm" c="dimmed">
                    This block is empty and can be safely deleted.
                  </Text>
                ) : (
                  <Text size="sm" c="red">
                    This block contains {blockStats.find(b => b.name === deletingBlock)?.total} room(s) and cannot be deleted.
                  </Text>
                )}

                <Group justify="flex-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      closeBlockModal();
                      setDeletingBlock(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    color="red"
                    disabled={blockStats.find(b => b.name === deletingBlock)?.total !== 0}
                  >
                    Delete Block
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}

          {!editingBlock && !deletingBlock && !creatingBlock && (
            <Stack>
              <Group justify="space-between" mb="md">
                <Text size="sm" c="dimmed">
                  Use the edit and delete buttons in the block overview section above to manage individual blocks.
                </Text>
                <Button 
                  leftSection={<IconPlus size={16} />}
                  size="compact-sm"
                  onClick={() => setCreatingBlock(true)}
                >
                  Create Block
                </Button>
              </Group>
              
              <Paper p="md" withBorder>
                <Text fw={500} mb="md">Block Summary</Text>
                <Stack gap="xs">
                  {blockStats.map((block) => (
                    <Group key={block.name} justify="space-between">
                      <Text>Block {block.name}</Text>
                      <Badge variant="light">{block.total} rooms</Badge>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              <Group justify="flex-end">
                <Button onClick={closeBlockModal}>
                  Close
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
