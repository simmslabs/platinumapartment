import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate, Outlet, useLocation, useNavigation } from "@remix-run/react";
import {
  Title,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  TextInput,
  Select,
  Alert,
  Paper,
  Divider,
  Checkbox,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconFilter, IconSearch, IconTrash, IconBuilding, IconBox, IconTrashX, IconAlertTriangle } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Room, AssetCondition, PricingPeriod, RoomStatus } from "@prisma/client";
import { useState, useMemo, useEffect } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Rooms - Apartment Management" },
    { name: "description", content: "Manage apartment units" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const rooms = await db.room.findMany({
    include: {
      type: true, // Include room type relationship
      blockRelation: true,
      assets: {
        include: {
          asset: true, // Include the actual asset details
        },
        orderBy: [
          { assignedAt: "asc" }, // Order by when asset was assigned
        ]
      },
    },
    orderBy: { number: "asc" },
  });

  // Get all active room types for filtering
  const roomTypes = await db.roomType.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const blocks = await db.block.findMany({
    orderBy: { name: "asc" },
  });

  return json({ user, rooms, blocks, roomTypes });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const number = formData.get("number") as string;
      const typeId = formData.get("type") as string; // This will be the room type ID
      const block = formData.get("block") as string;
      const floorStr = formData.get("floor") as string;
      const capacityStr = formData.get("capacity") as string;
      const pricePerNightStr = formData.get("pricePerNight") as string;
      const pricingPeriod = (formData.get("pricingPeriod") as PricingPeriod) || "NIGHT";
      const description = formData.get("description") as string;

      // Validate required fields
      if (!number || !typeId || !block || !floorStr || !capacityStr || !pricePerNightStr) {
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
          typeId,
          blockId: blockRecord.id,
          block, // Keep for backward compatibility
          floor,
          capacity,
          pricePerNight,
          pricingPeriod,
          description: description || null,
        },
      });

      return json({ success: "Room created successfully" });
    }

    if (intent === "update-status") {
      const roomId = formData.get("roomId") as string;
      const status = formData.get("status") as RoomStatus;

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

    if (intent === "bulk-delete") {
      const user = await requireUser(request);
      
      // Check if user is admin
      if (user.role !== "ADMIN") {
        return json({ error: "Only administrators can perform bulk delete operations" }, { status: 403 });
      }

      const roomIds = formData.getAll("roomIds") as string[];
      const confirmation = formData.get("confirm") as string;
      
      if (confirmation !== "DELETE") {
        return json({ error: "Confirmation text must be 'DELETE'" }, { status: 400 });
      }

      if (!roomIds || roomIds.length === 0) {
        return json({ error: "No rooms selected for deletion" }, { status: 400 });
      }

      // Validate that all rooms exist (quick check without including relations)
      const existingRooms = await db.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true },
      });

      if (existingRooms.length !== roomIds.length) {
        return json({ error: "Some selected rooms were not found" }, { status: 404 });
      }

      try {
        // For large bulk operations, process in smaller batches if needed
        if (roomIds.length > 50) {
          // Process in batches of 10 to avoid transaction timeouts
          const batchSize = 10;
          const batches = [];
          for (let i = 0; i < roomIds.length; i += batchSize) {
            batches.push(roomIds.slice(i, i + batchSize));
          }

          for (const batch of batches) {
            await db.$transaction(async (tx) => {
              // Get bookings for this batch
              const batchBookings = await tx.booking.findMany({
                where: { roomId: { in: batch } },
                select: { id: true },
              });
              const batchBookingIds = batchBookings.map(b => b.id);

              // Delete in correct order for this batch
              if (batchBookingIds.length > 0) {
                await tx.payment.deleteMany({
                  where: { bookingId: { in: batchBookingIds } },
                });
              }

              await tx.booking.deleteMany({
                where: { roomId: { in: batch } },
              });

              await tx.roomAsset.deleteMany({
                where: { roomId: { in: batch } },
              });

              await tx.maintenanceLog.deleteMany({
                where: { roomId: { in: batch } },
              });

              await tx.room.deleteMany({
                where: { id: { in: batch } },
              });
            }, {
              timeout: 15000, // 15 second timeout per batch
            });
          }
        } else {
          // For smaller operations, process all at once
          await db.$transaction(async (tx) => {
            // Collect all booking IDs first
            const allBookings = await tx.booking.findMany({
              where: { roomId: { in: roomIds } },
              select: { id: true },
            });
            const allBookingIds = allBookings.map(b => b.id);

            // Bulk delete operations (more efficient than looping)
            
            // 1. Delete all payments for all bookings at once
            if (allBookingIds.length > 0) {
              await tx.payment.deleteMany({
                where: { bookingId: { in: allBookingIds } },
              });
            }

            // 2. Delete all bookings for all rooms at once
            await tx.booking.deleteMany({
              where: { roomId: { in: roomIds } },
            });

            // 3. Delete all room assets for all rooms at once
            await tx.roomAsset.deleteMany({
              where: { roomId: { in: roomIds } },
            });

            // 4. Delete all maintenance logs for all rooms at once
            await tx.maintenanceLog.deleteMany({
              where: { roomId: { in: roomIds } },
            });

            // 5. Finally delete all rooms at once
            await tx.room.deleteMany({
              where: { id: { in: roomIds } },
            });
          }, {
            timeout: 30000, // 30 second timeout
          });
        }

        return json({ success: `Successfully deleted ${roomIds.length} room(s)` });
      } catch (error) {
        console.error("Bulk delete error:", error);
        
        // Handle specific Prisma transaction errors
        if (error && typeof error === 'object' && 'code' in error) {
          if (error.code === 'P2028') {
            return json({ error: "Transaction timeout. Please try selecting fewer rooms or try again." }, { status: 500 });
          }
          if (error.code === 'P2034') {
            return json({ error: "Transaction conflict. Please try again." }, { status: 500 });
          }
        }
        
        return json({ error: "Failed to delete rooms. Please try again with fewer rooms selected." }, { status: 500 });
      }
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Room action error:", error);
    // Type guard to check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      // Check which constraint failed
      if (error && 'meta' in error && error.meta && typeof error.meta === 'object' && 'target' in error.meta && Array.isArray(error.meta.target) && error.meta.target.includes('number') && error.meta.target.includes('blockId')) {
        return json({ error: "Room number already exists in this block" }, { status: 400 });
      }
      return json({ error: "Room number already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Rooms() {
  const { user, rooms, roomTypes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [blockModalOpened, { open: openBlockModal, close: closeBlockModal }] = useDisclosure(false);
  const [assetsModalOpened, { open: openAssetsModal, close: closeAssetsModal }] = useDisclosure(false);
  const [bulkDeleteModalOpened, { open: openBulkDeleteModal, close: closeBulkDeleteModal }] = useDisclosure(false);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<string | null>(null);
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<(typeof rooms)[0] | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState("");
  const location = useLocation();
  const navigation = useNavigation();
  
  // Check if we're currently submitting a bulk delete
  const isBulkDeleting = navigation.state === "submitting" && 
    navigation.formData?.get("_action") === "bulkDelete";
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [blockFilter, setBlockFilter] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [capacityFilter, setCapacityFilter] = useState<string | null>(null);

  // Helper functions for pricing periods
  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "NIGHT": return "night";
      case "DAY": return "day";
      case "WEEK": return "week";
      case "MONTH": return "month";
      case "YEAR": return "year";
      default: return "night";
    }
  };

  const formatPriceWithPeriod = (price: number, period: string) => {
    const label = getPeriodLabel(period);
    return `₵${price.toLocaleString()}/${label}`;
  };

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const safeRooms = rooms || [];
    const blocks = [...new Set(safeRooms.map(room => room.block))].sort();
    const floors = [...new Set(safeRooms.map(room => room.floor))].sort((a, b) => a - b);
    const capacities = [...new Set(safeRooms.map(room => room.capacity))].sort((a, b) => a - b);
    
    return {
      blocks: blocks.map(block => ({ value: block, label: `Block ${block}` })),
      floors: floors.map(floor => ({ value: floor.toString(), label: `Floor ${floor}` })),
      capacities: capacities.map(capacity => ({ value: capacity.toString(), label: `${capacity} guests` })),
    };
  }, [rooms]);

  // Get block statistics
  const blockStats = useMemo(() => {
    const safeRooms = rooms || [];
    return (filterOptions.blocks || []).map(blockOption => {
      const blockRooms = safeRooms.filter(room => room.block === blockOption.value);
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
          room.type.displayName.toLowerCase().includes(query) ||
          room.type.name.toLowerCase().includes(query) ||
          room.block.toLowerCase().includes(query) ||
          `${room.block}-${room.number}`.toLowerCase().includes(query) || // Allow searching by "Block-RoomNumber" format
          room.description?.toLowerCase().includes(query) ||
          room.status.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter && room.status !== statusFilter) return false;

      // Type filter  
      if (typeFilter && room.typeId !== typeFilter) return false;

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

  // Bulk selection handlers
  const handleSelectRoom = (roomId: string, checked: boolean) => {
    const newSelected = new Set(selectedRooms);
    if (checked) {
      newSelected.add(roomId);
    } else {
      newSelected.delete(roomId);
    }
    setSelectedRooms(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRooms(new Set(filteredRooms.map(room => room.id)));
    } else {
      setSelectedRooms(new Set());
    }
  };

  const isAllSelected = filteredRooms.length > 0 && selectedRooms.size === filteredRooms.length;
  const isIndeterminate = selectedRooms.size > 0 && selectedRooms.size < filteredRooms.length;

  // Clear selection when filters change
  useEffect(() => {
    setSelectedRooms(new Set());
  }, [searchQuery, statusFilter, typeFilter, blockFilter, floorFilter, capacityFilter]);

  const handleBulkDelete = () => {
    setBulkDeleteConfirmation("");
    openBulkDeleteModal();
  };

  // Reset confirmation text when modal closes
  const handleBulkDeleteModalClose = () => {
    setBulkDeleteConfirmation("");
    closeBulkDeleteModal();
  };

  // Handle modal close with deletion check
  const handleModalClose = () => {
    if (!isBulkDeleting) {
      handleBulkDeleteModalClose();
    }
  };

  // Close modals on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData) {
      close();
      closeBlockModal();
      setEditingBlock(null);
      setDeletingBlock(null);
      setCreatingBlock(false);
    }
  }, [actionData, closeBlockModal]);

  // Group rooms by blocks for better organization
  const roomsByBlock = useMemo(() => {
    const grouped = filteredRooms.reduce((acc, room) => {
      const blockKey = room.blockRelation?.id || room.block;
      const blockName = room.blockRelation?.name || room.block;
      
      if (!acc[blockKey]) {
        acc[blockKey] = {
          name: blockName,
          id: room.blockRelation?.id,
          rooms: [],
        };
      }
      acc[blockKey].rooms.push(room);
      return acc;
    }, {} as Record<string, { name: string; id?: string; rooms: typeof filteredRooms }>);
    
    // Sort rooms within each block by room number
    Object.keys(grouped).forEach(blockKey => {
      grouped[blockKey].rooms.sort((a, b) => a.number.localeCompare(b.number));
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

  const getAssetConditionColor = (condition: AssetCondition) => {
    switch (condition) {
      case "EXCELLENT":
        return "green";
      case "GOOD":
        return "blue";
      case "FAIR":
        return "yellow";
      case "POOR":
        return "orange";
      case "DAMAGED":
      case "BROKEN":
        return "red";
      case "MISSING":
        return "gray";
      default:
        return "gray";
    }
  };

  if(location.pathname !== "/dashboard/rooms") return <Outlet />

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
                <Button 
                  leftSection={<IconPlus size={16} />} 
                  onClick={() => navigate("/dashboard/rooms/new")}
                >
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
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
              {blockStats.map((block) => (
                <Card key={block.name} p="sm" withBorder>
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
              ))}
            </SimpleGrid>
          </Paper>
        )}

        {actionData && 'error' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
          >
            {'error' in actionData ? actionData.error : ''}
          </Alert>
        )}

        {actionData && 'success' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
          >
            {'success' in actionData ? actionData.success : ''}
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
          
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }}>
            <TextInput
                placeholder="Search rooms (try A-101)..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
            
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
            
            <Select
                placeholder="All Types"
                data={(roomTypes || []).map(type => ({ value: type.id, label: type.displayName }))}
                value={typeFilter}
                onChange={setTypeFilter}
                clearable
              />
            
            <Select
                placeholder="All Blocks"
                data={filterOptions.blocks || []}
                value={blockFilter}
                onChange={setBlockFilter}
                clearable
              />
            
            <Select
                placeholder="All Floors"
                data={filterOptions.floors || []}
                value={floorFilter}
                onChange={setFloorFilter}
                clearable
              />

            <Select
                placeholder="All Capacities"
                data={filterOptions.capacities || []}
                value={capacityFilter}
                onChange={setCapacityFilter}
                clearable
              />
          </SimpleGrid>
          
          <Divider my="md" />
          
          <Group justify="space-between">
            <Group>
              <Text size="sm" c="dimmed">
                Showing {filteredRooms.length} of {rooms.length} rooms
              </Text>
              {user?.role === "ADMIN" && filteredRooms.length > 0 && (
                <Checkbox
                  label="Select All"
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(event) => handleSelectAll(event.currentTarget.checked)}
                />
              )}
              {user?.role === "ADMIN" && selectedRooms.size > 0 && (
                <Group gap="xs">
                  <Badge variant="light" color="red">
                    {selectedRooms.size} selected
                  </Badge>
                  <Button
                    size="compact-sm"
                    color="red"
                    variant="light"
                    leftSection={<IconTrashX size={14} />}
                    onClick={handleBulkDelete}
                  >
                    Bulk Delete
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    onClick={() => setSelectedRooms(new Set())}
                  >
                    Clear Selection
                  </Button>
                </Group>
              )}
            </Group>
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
              .sort(([, blockA], [, blockB]) => blockA.name.localeCompare(blockB.name))
              .map(([blockKey, blockData]) => (
              <div key={blockKey}>
                <Card
                  shadow="sm"
                  p="md"
                  mb="md"
                  style={{ 
                    cursor: blockData.id ? 'pointer' : 'default',
                    '&:hover': blockData.id ? { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } : {}
                  }}
                  onClick={() => {
                    if (blockData.id) {
                      navigate(`/dashboard/blocks/${blockData.id}`);
                    }
                  }}
                >
                  <Group justify="space-between">
                    <Group>
                      <Title order={3} c="blue">Block {blockData.name}</Title>
                      <Badge variant="light" color="blue" size="lg">
                        {blockData.rooms.length} room{blockData.rooms.length !== 1 ? 's' : ''}
                      </Badge>
                    </Group>
                    {blockData.id && (
                      <Text size="sm" c="dimmed">
                        Click to view details →
                      </Text>
                    )}
                  </Group>
                </Card>
                
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                  {blockData.rooms.map((room) => (
                    <Card 
                      key={room.id} 
                      shadow="sm" 
                      p="lg" 
                      h="100%" 
                      style={{ cursor: 'pointer', position: 'relative' }}
                      onClick={() => navigate(`/dashboard/rooms/${room.id}`)}
                    >
                      {user?.role === "ADMIN" && (
                        <Checkbox
                          checked={selectedRooms.has(room.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleSelectRoom(room.id, event.currentTarget.checked);
                          }}
                          style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
                        />
                      )}
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
                            <strong>Type:</strong> {room.type.displayName}
                          </Text>
                          <Text size="sm">
                            <strong>Block:</strong> {room.blockRelation ? `${room.blockRelation.name} - ${room.blockRelation.description}` : room.block}
                          </Text>
                          <Text size="sm">
                            <strong>Floor:</strong> {room.floor}
                          </Text>
                          <Text size="sm">
                            <strong>Capacity:</strong> {room.capacity} guests
                          </Text>
                          <Text size="sm">
                            <strong>Price:</strong> {formatPriceWithPeriod(room.pricePerNight, room.pricingPeriod || "NIGHT")}
                          </Text>
                          {room.description && (
                            <Text size="sm" c="dimmed">
                              {room.description}
                            </Text>
                          )}
                        </Stack>

                        <Group justify="space-between" mt="md">
                          <Group gap="xs">
                            <Button size="xs" variant="light" onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/rooms/${room.id}`);
                            }}>
                              View Details
                            </Button>
                            
                            <Button 
                              size="xs" 
                              variant="outline" 
                              leftSection={<IconBox size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRoom(room);
                                openAssetsModal();
                              }}
                            >
                              Assets ({room.assets?.length || 0})
                            </Button>
                          </Group>
                          
                          {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                            <Form method="post" onClick={(e) => e.stopPropagation()}>
                              <input type="hidden" name="intent" value="update-status" />
                              <input type="hidden" name="roomId" value={room.id} />
                              <Select
                                size="xs"
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
                        </Group>
                      </Card>
                  ))}
                </SimpleGrid>
              </div>
            ))}
          </Stack>
        )}

        {/* Room creation has been moved to /dashboard/rooms/new route */}

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
                  Are you sure you want to delete block &quot;{deletingBlock}&quot;? This action cannot be undone.
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

        {/* Assets Modal */}
        <Modal 
          opened={assetsModalOpened} 
          onClose={closeAssetsModal} 
          title={selectedRoom ? `Assets in Room ${selectedRoom.number}` : "Room Assets"} 
          size="xl"
        >
          {selectedRoom && (
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Total Assets: {selectedRoom.assets?.length || 0}
                </Text>
                {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                  <Button 
                    size="xs" 
                    leftSection={<IconPlus size={14} />}
                    onClick={() => navigate(`/dashboard/rooms/${selectedRoom.id}/assets/new`)}
                  >
                    Add Asset
                  </Button>
                )}
              </Group>

              {selectedRoom.assets && selectedRoom.assets.length > 0 ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  {selectedRoom.assets.map((roomAsset) => (
                    <Card key={roomAsset.id} withBorder>
                      <Group justify="space-between" mb="xs">
                        <Text fw={500}>{roomAsset.asset.name}</Text>
                        <Badge 
                          color={getAssetConditionColor(roomAsset.condition)}
                          size="sm"
                        >
                          {roomAsset.condition}
                        </Badge>
                      </Group>
                      
                      <Stack gap="xs">
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">Category:</Text>
                          <Badge variant="light" size="xs">
                            {roomAsset.asset.category.replace('_', ' ')}
                          </Badge>
                        </Group>
                        
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">Quantity:</Text>
                          <Text size="sm">{roomAsset.quantity}</Text>
                        </Group>
                        
                        {roomAsset.asset.description && (
                          <Text size="sm" c="dimmed">{roomAsset.asset.description}</Text>
                        )}
                        
                        {roomAsset.asset.serialNumber && (
                          <Group gap="xs">
                            <Text size="sm" c="dimmed">Serial:</Text>
                            <Text size="sm" ff="monospace">{roomAsset.asset.serialNumber}</Text>
                          </Group>
                        )}
                        
                        {roomAsset.asset.lastInspected && (
                          <Group gap="xs">
                            <Text size="sm" c="dimmed">Last Inspected:</Text>
                            <Text size="sm">
                              {new Date(roomAsset.asset.lastInspected).toLocaleDateString()}
                            </Text>
                          </Group>
                        )}
                        
                        {roomAsset.notes && (
                          <Text size="xs" c="orange" style={{ fontStyle: 'italic' }}>
                            Room Note: {roomAsset.notes}
                          </Text>
                        )}
                      </Stack>
                      
                      {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                        <Group justify="flex-end" mt="md">
                          <Button size="xs" variant="light" leftSection={<IconEdit size={12} />}>
                            Edit
                          </Button>
                        </Group>
                      )}
                    </Card>
                  ))}
                </SimpleGrid>
              ) : (
                <Text ta="center" c="dimmed" py="xl">
                  No assets found for this room
                </Text>
              )}
              
              <Group justify="flex-end">
                <Button onClick={closeAssetsModal}>
                  Close
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Bulk Delete Modal */}
        <Modal
          opened={bulkDeleteModalOpened}
          onClose={handleModalClose}
          title="Bulk Delete Rooms"
          size="md"
          closeOnClickOutside={!isBulkDeleting}
          closeOnEscape={!isBulkDeleting}
        >
          <Form method="post">
            <input type="hidden" name="intent" value="bulk-delete" />
            {Array.from(selectedRooms).map(roomId => (
              <input key={roomId} type="hidden" name="roomIds" value={roomId} />
            ))}
            
            <Stack>
              <Alert
                icon={<IconAlertTriangle size={16} />}
                title="Warning: This action cannot be undone"
                color="red"
              >
                <Stack gap={4}>
                  <Text>
                    You are about to permanently delete {selectedRooms.size} room(s) and all associated data including:
                  </Text>
                  <ul>
                    <li>All bookings and payment records</li>
                    <li>All assigned assets</li>
                    <li>All maintenance logs</li>
                    <li>All guest data for these rooms</li>
                  </ul>
                  <Text>
                    This is a force delete operation that will bypass all safety checks.
                  </Text>
                  <Text fw={600} c="red" mt="sm">
                    To proceed, you must type exactly &quot;DELETE&quot; (all capitals) in the field below.
                  </Text>
                </Stack>
              </Alert>

              <TextInput
                label={
                  <Group gap={4}>
                    <Text fw={600} c="red">Type DELETE to confirm</Text>
                    <Text size="xs" c="dimmed">(case sensitive)</Text>
                  </Group>
                }
                description={
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Must match exactly: DELETE
                    </Text>
                    <Text 
                      size="xs" 
                      c={bulkDeleteConfirmation === "DELETE" ? "green" : "dimmed"}
                    >
                      {bulkDeleteConfirmation.length}/6 characters
                    </Text>
                  </Group>
                }
                placeholder="DELETE"
                name="confirm"
                value={bulkDeleteConfirmation}
                onChange={(event) => setBulkDeleteConfirmation(event.currentTarget.value)}
                error={
                  bulkDeleteConfirmation.length > 0 && bulkDeleteConfirmation !== "DELETE" 
                    ? `Must type exactly "DELETE" (you typed "${bulkDeleteConfirmation}")` 
                    : undefined
                }
                styles={{
                  input: {
                    fontFamily: 'monospace',
                    backgroundColor: bulkDeleteConfirmation === "DELETE" ? 'var(--mantine-color-green-0)' : undefined,
                    borderColor: bulkDeleteConfirmation === "DELETE" ? 'var(--mantine-color-green-6)' : undefined,
                  }
                }}
                rightSection={
                  bulkDeleteConfirmation === "DELETE" ? (
                    <Text c="green" size="lg">✓</Text>
                  ) : null
                }
                required
              />

              <Group justify="flex-end">
                <Button 
                  variant="outline" 
                  onClick={handleBulkDeleteModalClose}
                  disabled={isBulkDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="red"
                  disabled={bulkDeleteConfirmation !== "DELETE" || isBulkDeleting}
                  loading={isBulkDeleting}
                  leftSection={!isBulkDeleting ? <IconTrashX size={16} /> : undefined}
                  style={{
                    opacity: bulkDeleteConfirmation !== "DELETE" ? 0.5 : 1,
                  }}
                >
                  {isBulkDeleting
                    ? "Deleting..."
                    : bulkDeleteConfirmation === "DELETE" 
                      ? `✓ Delete ${selectedRooms.size} Room(s)` 
                      : `Delete ${selectedRooms.size} Room(s)`
                  }
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
