import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate } from "@remix-run/react";
import {
  Title,
  Text,
  Button,
  Stack,
  Group,
  TextInput,
  NumberInput,
  Select,
  MultiSelect,
  Textarea,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
  Divider,
  Card,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle } from "@tabler/icons-react";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { PricingPeriod, AssetCondition } from "@prisma/client";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Add New Room - Apartment Management" },
    { name: "description", content: "Add a new room to the apartment" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Get all blocks for the select dropdown
  const blocks = await db.block.findMany({
    orderBy: { name: "asc" },
  });

  // Get all active room types
  const roomTypes = await db.roomType.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  // Get all existing assets for selection
  const availableAssets = await db.asset.findMany({
    orderBy: [
      { category: "asc" },
      { name: "asc" }
    ],
  });

  return json({ user, blocks, roomTypes, availableAssets });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  
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

  if (isNaN(floor) || isNaN(capacity) || isNaN(pricePerNight)) {
    return json({ error: "Floor, capacity, and price must be valid numbers" }, { status: 400 });
  }

  // Parse selected existing assets with their assignments
  const selectedAssetAssignments: Array<{
    assetId: string;
    condition: AssetCondition;
    quantity: number;
  }> = [];
  
  let selectedAssetIndex = 0;
  while (formData.has(`selectedAssets[${selectedAssetIndex}][assetId]`)) {
    const assetId = formData.get(`selectedAssets[${selectedAssetIndex}][assetId]`) as string;
    const condition = formData.get(`selectedAssets[${selectedAssetIndex}][condition]`) as AssetCondition;
    const quantityStr = formData.get(`selectedAssets[${selectedAssetIndex}][quantity]`) as string;
    
    if (assetId && condition && quantityStr) {
      const quantity = parseInt(quantityStr);
      if (!isNaN(quantity) && quantity > 0) {
        selectedAssetAssignments.push({
          assetId,
          condition,
          quantity,
        });
      }
    }
    selectedAssetIndex++;
  }

  try {
    // Check if block exists, if not create it
    let blockRecord = await db.block.findUnique({
      where: { name: block },
    });

    if (!blockRecord) {
      blockRecord = await db.block.create({
        data: {
          name: block,
          description: `Block ${block}`,
        },
      });
    }

    // Create the room and its assets in a transaction
    await db.$transaction(async (tx) => {
      // Create the room
      const newRoom = await tx.room.create({
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

      // Assign selected existing assets to this room with their conditions and quantities
      if (selectedAssetAssignments.length > 0) {
        for (const assignment of selectedAssetAssignments) {
          await tx.roomAsset.create({
            data: {
              roomId: newRoom.id,
              assetId: assignment.assetId,
              condition: assignment.condition,
              quantity: assignment.quantity,
            },
          });
        }
      }

      return newRoom;
    });

    return redirect("/dashboard/rooms");
  } catch (error) {
    console.error("Room creation error:", error);
    if (error instanceof Error && error.message.includes("P2002")) {
      // Check which constraint failed
      if (error.message.includes('number') && error.message.includes('blockId')) {
        return json({ error: "Room number already exists in this block" }, { status: 400 });
      }
      return json({ error: "Room number already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function AddRoom() {
  const { user, blocks, roomTypes, availableAssets } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // State for selected existing assets with their conditions and quantities
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetAssignments, setAssetAssignments] = useState<Record<string, { condition: AssetCondition | "", quantity: number }>>({});

  // Convert room types to select data format
  const roomTypeSelectData = roomTypes.map(type => ({
    value: type.id,
    label: type.displayName,
  }));

  const pricingPeriods = [
    { value: "NIGHT", label: "Per Night" },
    { value: "DAY", label: "Per Day" },
    { value: "WEEK", label: "Per Week" },
    { value: "MONTH", label: "Per Month" },
    { value: "YEAR", label: "Per Year" },
  ];

  const assetConditions = [
    { value: "EXCELLENT", label: "Excellent" },
    { value: "GOOD", label: "Good" },
    { value: "FAIR", label: "Fair" },
    { value: "POOR", label: "Poor" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "NEEDS_REPAIR", label: "Needs Repair" },
    { value: "OUT_OF_ORDER", label: "Out of Order" },
  ];

  // Prepare block data for select
  const blockData = blocks.map(block => ({
    value: block.name,
    label: `Block ${block.name} - ${block.description || 'No description'}`,
  }));

  // Handle asset assignment updates
  const handleAssetSelectionChange = (assetIds: string[]) => {
    setSelectedAssetIds(assetIds);
    
    // Initialize assignments for new assets with default values
    const newAssignments = { ...assetAssignments };
    assetIds.forEach(assetId => {
      if (!newAssignments[assetId]) {
        newAssignments[assetId] = { condition: "GOOD", quantity: 1 };
      }
    });
    
    // Remove assignments for deselected assets
    Object.keys(newAssignments).forEach(assetId => {
      if (!assetIds.includes(assetId)) {
        delete newAssignments[assetId];
      }
    });
    
    setAssetAssignments(newAssignments);
  };

  const updateAssetAssignment = (assetId: string, field: 'condition' | 'quantity', value: AssetCondition | "" | number) => {
    setAssetAssignments(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        [field]: value,
      },
    }));
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Breadcrumbs>
          <Anchor component="button" onClick={() => navigate("/dashboard/rooms")}>
            Rooms
          </Anchor>
          <Text>Add New Room</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <div>
            <Title order={2}>Add New Room</Title>
            <Text size="sm" c="dimmed">
              Create a new room in the apartment complex
            </Text>
          </div>
          <Button 
            variant="light" 
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/dashboard/rooms")}
          >
            Back to Rooms
          </Button>
        </Group>

        {actionData?.error && (
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Error" 
            color="red"
            variant="light"
          >
            {actionData.error}
          </Alert>
        )}

        <Paper p="md" withBorder>
          <Form method="post">
            <Stack gap="md">
              <Group grow>
                <TextInput
                  label="Room Number"
                  name="number"
                  placeholder="e.g., 101, A-205"
                  required
                />
                <Select
                  label="Room Type"
                  name="type"
                  placeholder="Select room type"
                  data={roomTypeSelectData}
                  required
                />
              </Group>

              <Group grow>
                <Select
                  label="Block"
                  name="block"
                  placeholder="Select or type new block"
                  data={blockData}
                  searchable
                  required
                />
                <NumberInput
                  label="Floor"
                  name="floor"
                  placeholder="Floor number"
                  min={1}
                  required
                />
              </Group>

              <Group grow>
                <NumberInput
                  label="Capacity"
                  name="capacity"
                  placeholder="Number of guests"
                  min={1}
                  required
                />
                <NumberInput
                  label="Price"
                  name="pricePerNight"
                  placeholder="Price amount"
                  min={0}
                  step={0.01}
                  decimalScale={2}
                  required
                />
              </Group>

              <Select
                label="Pricing Period"
                name="pricingPeriod"
                placeholder="Select pricing period"
                data={pricingPeriods}
                defaultValue="NIGHT"
                required
              />

              <Textarea
                label="Description"
                name="description"
                placeholder="Optional description of the room"
                rows={3}
              />

              {/* Room Assets Section */}
              <Divider label="Room Assets (Optional)" labelPosition="center" mt="xl" my="lg" />

              {/* Select Existing Assets */}
              {availableAssets.length > 0 && (
                <Stack gap="md">
                  <MultiSelect
                    label="Assign Existing Assets"
                    description="Select from unassigned assets to add to this room"
                    placeholder="Choose existing assets..."
                    data={(availableAssets || []).map(asset => ({
                      value: asset.id,
                      label: `${asset.name} (${asset.category})`,
                    }))}
                    value={selectedAssetIds}
                    onChange={handleAssetSelectionChange}
                    searchable
                    clearable
                    mb="md"
                  />

                  {/* Condition and Quantity inputs for selected assets */}
                  {selectedAssetIds.length > 0 && (
                    <Stack gap="lg">
                      <Text size="sm" fw={500} c="blue">Configure Selected Assets</Text>
                      {selectedAssetIds.map((assetId) => {
                        const asset = availableAssets.find(a => a.id === assetId);
                        const assignment = assetAssignments[assetId];
                        
                        if (!asset || !assignment) return null;
                        
                        return (
                          <Card key={assetId} p="md" withBorder>
                            <Stack gap="md">
                              <Group justify="space-between" align="center">
                                <Text size="sm" fw={500}>{asset.name}</Text>
                                <Text size="xs" c="dimmed">{asset.category}</Text>
                              </Group>
                              
                              <Group grow>
                                <Select
                                  label="Condition in this room"
                                  value={assignment.condition}
                                  onChange={(value) => updateAssetAssignment(assetId, 'condition', value as AssetCondition || "")}
                                  data={assetConditions}
                                  placeholder="Select condition"
                                  required
                                />
                                <NumberInput
                                  label="Quantity"
                                  value={assignment.quantity}
                                  onChange={(value) => updateAssetAssignment(assetId, 'quantity', Number(value) || 1)}
                                  min={1}
                                  required
                                />
                              </Group>
                            </Stack>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              )}

              {/* Hidden inputs for selected existing assets with their assignments */}
              {selectedAssetIds.map((assetId, index) => {
                const assignment = assetAssignments[assetId];
                if (!assignment) return null;
                
                return (
                  <div key={assetId}>
                    <input 
                      type="hidden" 
                      name={`selectedAssets[${index}][assetId]`} 
                      value={assetId} 
                    />
                    <input 
                      type="hidden" 
                      name={`selectedAssets[${index}][condition]`} 
                      value={assignment.condition} 
                    />
                    <input 
                      type="hidden" 
                      name={`selectedAssets[${index}][quantity]`} 
                      value={assignment.quantity.toString()} 
                    />
                  </div>
                );
              })}

              <Group justify="flex-end">
                <Button 
                  variant="light" 
                  onClick={() => navigate("/dashboard/rooms")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  leftSection={<IconDeviceFloppy size={16} />}
                >
                  Create Room
                </Button>
              </Group>
            </Stack>
          </Form>
        </Paper>
      </Stack>
    </DashboardLayout>
  );
}
