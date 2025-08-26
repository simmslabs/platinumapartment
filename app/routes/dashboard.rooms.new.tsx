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
  Textarea,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
  Divider,
  Card,
  ActionIcon,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle, IconPlus, IconTrash } from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { RoomType, PricingPeriod, AssetCategory, AssetCondition } from "@prisma/client";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Add New Room - Apartment Management" },
    { name: "description", content: "Add a new room to the apartment" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Get all blocks for the select dropdown
  const blocks = await db.block.findMany({
    orderBy: { name: "asc" },
  });

  return json({ user, blocks });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  
  const number = formData.get("number") as string;
  const type = formData.get("type") as RoomType;
  const block = formData.get("block") as string;
  const floorStr = formData.get("floor") as string;
  const capacityStr = formData.get("capacity") as string;
  const pricePerNightStr = formData.get("pricePerNight") as string;
  const pricingPeriod = (formData.get("pricingPeriod") as PricingPeriod) || "NIGHT";
  const description = formData.get("description") as string;

  // Validate required fields
  if (!number || !type || !block || !floorStr || !capacityStr || !pricePerNightStr) {
    return json({ error: "All required fields must be filled" }, { status: 400 });
  }

  // Parse numeric values
  const floor = parseInt(floorStr);
  const capacity = parseInt(capacityStr);
  const pricePerNight = parseFloat(pricePerNightStr);

  if (isNaN(floor) || isNaN(capacity) || isNaN(pricePerNight)) {
    return json({ error: "Floor, capacity, and price must be valid numbers" }, { status: 400 });
  }

  // Parse assets data
  const assetsData: Array<{
    name: string;
    category: AssetCategory;
    quantity: number;
    condition: AssetCondition;
    description?: string;
    serialNumber?: string;
  }> = [];

  // Get all asset entries from form data
  let assetIndex = 0;
  while (formData.has(`assets[${assetIndex}][name]`)) {
    const name = formData.get(`assets[${assetIndex}][name]`) as string;
    const category = formData.get(`assets[${assetIndex}][category]`) as AssetCategory;
    const quantityStr = formData.get(`assets[${assetIndex}][quantity]`) as string;
    const condition = formData.get(`assets[${assetIndex}][condition]`) as AssetCondition;
    const description = formData.get(`assets[${assetIndex}][description]`) as string;
    const serialNumber = formData.get(`assets[${assetIndex}][serialNumber]`) as string;

    if (name && category && quantityStr && condition) {
      const quantity = parseInt(quantityStr);
      if (!isNaN(quantity) && quantity > 0) {
        assetsData.push({
          name,
          category,
          quantity,
          condition,
          description: description || undefined,
          serialNumber: serialNumber || undefined,
        });
      }
    }
    assetIndex++;
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
          type,
          blockId: blockRecord.id,
          block, // Keep for backward compatibility
          floor,
          capacity,
          pricePerNight,
          pricingPeriod,
          description: description || null,
        },
      });

      // Create assets if any
      if (assetsData.length > 0) {
        await tx.roomAsset.createMany({
          data: assetsData.map(asset => ({
            ...asset,
            roomId: newRoom.id,
          })),
        });
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
  const { user, blocks } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // State for managing assets
  const [assets, setAssets] = useState<Array<{
    id: string;
    name: string;
    category: AssetCategory | "";
    quantity: number;
    condition: AssetCondition | "";
    description: string;
    serialNumber: string;
  }>>([]);

  const roomTypes = [
    { value: "SINGLE", label: "Single" },
    { value: "DOUBLE", label: "Double" },
    { value: "SUITE", label: "Suite" },
    { value: "DELUXE", label: "Deluxe" },
    { value: "PRESIDENTIAL", label: "Presidential" },
  ];

  const pricingPeriods = [
    { value: "NIGHT", label: "Per Night" },
    { value: "DAY", label: "Per Day" },
    { value: "WEEK", label: "Per Week" },
    { value: "MONTH", label: "Per Month" },
    { value: "YEAR", label: "Per Year" },
  ];

  const assetCategories = [
    { value: "FURNITURE", label: "Furniture" },
    { value: "ELECTRONICS", label: "Electronics" },
    { value: "APPLIANCES", label: "Appliances" },
    { value: "BEDDING", label: "Bedding" },
    { value: "BATHROOM", label: "Bathroom" },
    { value: "KITCHEN", label: "Kitchen" },
    { value: "LIGHTING", label: "Lighting" },
    { value: "DECORATION", label: "Decoration" },
    { value: "SAFETY", label: "Safety" },
    { value: "OTHER", label: "Other" },
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

  const addAsset = () => {
    setAssets(prev => [...prev, {
      id: Date.now().toString(),
      name: "",
      category: "",
      quantity: 1,
      condition: "",
      description: "",
      serialNumber: "",
    }]);
  };

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== id));
  };

  const updateAsset = (id: string, field: string, value: string | number) => {
    setAssets(prev => prev.map(asset => 
      asset.id === id ? { ...asset, [field]: value } : asset
    ));
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
                  data={roomTypes}
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

              <Group justify="space-between" align="center" mb="md">
                <Text size="sm" c="dimmed">
                  Add assets that will be included with this room
                </Text>
                <Button
                  size="compact-sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={addAsset}
                  variant="light"
                >
                  Add Asset
                </Button>
              </Group>

              {assets.length > 0 && (
                <Stack gap="lg">
                  {assets.map((asset, index) => (
                    <Card key={asset.id} p="lg" withBorder shadow="sm">
                      <Stack gap="md">
                        <Group justify="space-between" align="flex-start">
                          <Text size="sm" fw={500} c="blue">Asset #{index + 1}</Text>
                          <ActionIcon
                            size="sm"
                            color="red"
                            variant="light"
                            onClick={() => removeAsset(asset.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>

                        <Group grow>
                          <TextInput
                            label="Asset Name"
                            name={`assets[${index}][name]`}
                            value={asset.name}
                            onChange={(e) => updateAsset(asset.id, "name", e.target.value)}
                            placeholder="e.g., Queen Bed, TV, Refrigerator"
                            required
                          />
                          <Select
                            label="Category"
                            name={`assets[${index}][category]`}
                            value={asset.category}
                            onChange={(value) => updateAsset(asset.id, "category", value || "")}
                            data={assetCategories}
                            placeholder="Select category"
                            required
                          />
                        </Group>

                        <Group grow>
                          <NumberInput
                            label="Quantity"
                            name={`assets[${index}][quantity]`}
                            value={asset.quantity}
                            onChange={(value) => updateAsset(asset.id, "quantity", Number(value) || 1)}
                            min={1}
                            required
                          />
                          <Select
                            label="Condition"
                            name={`assets[${index}][condition]`}
                            value={asset.condition}
                            onChange={(value) => updateAsset(asset.id, "condition", value || "")}
                            data={assetConditions}
                            placeholder="Select condition"
                            required
                          />
                        </Group>

                        <Group grow>
                          <TextInput
                            label="Serial Number"
                            name={`assets[${index}][serialNumber]`}
                            value={asset.serialNumber}
                            onChange={(e) => updateAsset(asset.id, "serialNumber", e.target.value)}
                            placeholder="Optional serial number"
                          />
                          <TextInput
                            label="Description"
                            name={`assets[${index}][description]`}
                            value={asset.description}
                            onChange={(e) => updateAsset(asset.id, "description", e.target.value)}
                            placeholder="Optional description or notes"
                          />
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}

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
