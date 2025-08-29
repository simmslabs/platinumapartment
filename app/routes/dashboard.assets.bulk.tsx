import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate } from "@remix-run/react";
import {
  Title,
  Text,
  Button,
  Stack,
  Group,
  Select,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
  Container,
  Table,
  NumberInput,
  ActionIcon,
  Badge,
  Divider,
  TextInput,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle, IconPlus, IconTrash, IconPackages } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { AssetCategory, AssetCondition } from "@prisma/client";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Bulk Add Assets - Apartment Management" },
    { name: "description", content: "Add multiple assets at once to any room" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Get all rooms for the dropdown
  const rooms = await db.room.findMany({
    include: {
      type: {
        select: {
          displayName: true,
          name: true,
        },
      },
      blockRelation: true,
    },
    orderBy: [
      { block: "asc" },
      { number: "asc" },
    ],
  });

  return json({ user, rooms });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const formData = await request.formData();
  const roomId = formData.get("roomId") as string;
  
  // Parse assets data from form
  const assetsData = [];
  let index = 0;
  
  while (formData.has(`asset_${index}_name`)) {
    const name = formData.get(`asset_${index}_name`) as string;
    const category = formData.get(`asset_${index}_category`) as AssetCategory;
    const condition = formData.get(`asset_${index}_condition`) as AssetCondition;
    const quantity = parseInt(formData.get(`asset_${index}_quantity`) as string);
    
    if (name && category && condition && !isNaN(quantity) && quantity > 0) {
      assetsData.push({
        name,
        category,
        condition,
        quantity,
      });
    }
    index++;
  }

  // Validation
  if (!roomId) {
    return json({
      error: "Please select a room.",
    }, { status: 400 });
  }

  if (assetsData.length === 0) {
    return json({
      error: "Please add at least one asset.",
    }, { status: 400 });
  }

  // Verify room exists
  const room = await db.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return json({
      error: "Selected room not found.",
    }, { status: 400 });
  }

  try {
    // Create all assets
    const createdAssets = await Promise.all(
      assetsData.map(assetData =>
        db.roomAsset.create({
          data: {
            roomId,
            ...assetData,
          },
        })
      )
    );

    return redirect(`/dashboard/rooms/${roomId}?assets_added=${createdAssets.length}`);
  } catch (error) {
    console.error("Error creating assets:", error);
    return json({
      error: "Failed to create assets. Please try again.",
    }, { status: 500 });
  }
}

interface AssetFormData {
  id: string;
  name: string;
  category: AssetCategory | '';
  condition: AssetCondition | '';
  quantity: number;
}

export default function BulkAddAssets() {
  const loaderData = useLoaderData<typeof loader>();
  const { user, rooms } = loaderData || {};
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [assets, setAssets] = useState<AssetFormData[]>([
    { id: '1', name: '', category: '', condition: '', quantity: 1 },
    { id: '2', name: '', category: '', condition: '', quantity: 1 },
    { id: '3', name: '', category: '', condition: '', quantity: 1 },
  ]);

  // Format rooms for the select dropdown
  const roomOptions = (rooms || []).map((room) => ({
    value: room.id,
    label: `${room.number} - ${room.type?.displayName || 'Unknown'} (${room.blockRelation?.name || room.block || 'Unknown'})`,
  }));

  const categoryOptions = [
    { value: "FURNITURE", label: "🪑 Furniture" },
    { value: "ELECTRONICS", label: "📺 Electronics" },
    { value: "BATHROOM", label: "🚿 Bathroom" },
    { value: "KITCHEN", label: "🍽️ Kitchen" },
    { value: "BEDDING", label: "🛏️ Bedding" },
    { value: "LIGHTING", label: "💡 Lighting" },
    { value: "SAFETY", label: "🚨 Safety" },
    { value: "DECORATION", label: "🖼️ Decoration" },
    { value: "CLEANING", label: "🧹 Cleaning" },
    { value: "OTHER", label: "📦 Other" },
  ];

  const conditionOptions = [
    { value: "EXCELLENT", label: "Excellent" },
    { value: "GOOD", label: "Good" },
    { value: "FAIR", label: "Fair" },
    { value: "POOR", label: "Poor" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "BROKEN", label: "Broken" },
    { value: "MISSING", label: "Missing" },
  ];

  const addAsset = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setAssets([...assets, { id: newId, name: '', category: '', condition: '', quantity: 1 }]);
  };

  const removeAsset = (id: string) => {
    if (assets.length > 1) {
      setAssets(assets.filter(asset => asset.id !== id));
    }
  };

  const updateAsset = (id: string, field: keyof AssetFormData, value: string | number) => {
    setAssets(assets.map(asset => 
      asset.id === id ? { ...asset, [field]: value } : asset
    ));
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "EXCELLENT": return "green";
      case "GOOD": return "blue";
      case "FAIR": return "yellow";
      case "POOR": return "orange";
      case "DAMAGED": return "red";
      case "BROKEN": return "red";
      case "MISSING": return "red";
      default: return "gray";
    }
  };

  const filledAssetsCount = assets.filter(asset => 
    asset.name && asset.category && asset.condition && asset.quantity > 0
  ).length;

  return (
    <DashboardLayout user={user}>
      <Container size="lg">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate("/dashboard/assets")}
              >
                Back to Assets
              </Button>
              <div>
                <Title order={2}>Bulk Add Assets</Title>
                <Breadcrumbs>
                  <Anchor component="button" onClick={() => navigate("/dashboard/assets")}>
                    Assets
                  </Anchor>
                  <Text>Bulk Add</Text>
                </Breadcrumbs>
              </div>
            </Group>
            <IconPackages size={32} color="var(--mantine-color-blue-6)" />
          </Group>

          {/* Error Message */}
          {actionData?.error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {actionData.error}
            </Alert>
          )}

          {/* Room Selection */}
          <Paper withBorder p="lg">
            <Stack gap="md">
              <Title order={3}>Select Room</Title>
              <Select
                label="Room"
                placeholder="Select a room for these assets"
                data={roomOptions || []}
                value={selectedRoomId}
                onChange={(value) => setSelectedRoomId(value || '')}
                searchable
                required
                description="All assets will be added to this room"
              />
            </Stack>
          </Paper>

          {/* Assets Form */}
          <Paper withBorder p="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3}>Assets to Add</Title>
                <Group gap="xs">
                  <Badge variant="light" color="blue">
                    {filledAssetsCount} ready to create
                  </Badge>
                  <Button
                    size="sm"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    onClick={addAsset}
                  >
                    Add Row
                  </Button>
                </Group>
              </Group>

              <Form method="post">
                <input type="hidden" name="roomId" value={selectedRoomId} />
                
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Asset Name</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Condition</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {assets.map((asset, index) => (
                      <Table.Tr key={asset.id}>
                        <Table.Td>
                          <TextInput
                            name={`asset_${index}_name`}
                            placeholder="e.g., Queen Size Bed"
                            value={asset.name}
                            onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                            size="sm"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            name={`asset_${index}_category`}
                            placeholder="Category"
                            data={categoryOptions}
                            value={asset.category}
                            onChange={(value) => updateAsset(asset.id, 'category', value as AssetCategory)}
                            size="sm"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            name={`asset_${index}_condition`}
                            placeholder="Condition"
                            data={conditionOptions}
                            value={asset.condition}
                            onChange={(value) => updateAsset(asset.id, 'condition', value as AssetCondition)}
                            size="sm"
                          />
                          {asset.condition && (
                            <Badge 
                              size="xs" 
                              color={getConditionColor(asset.condition)}
                              mt="xs"
                            >
                              {asset.condition}
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            name={`asset_${index}_quantity`}
                            value={asset.quantity}
                            onChange={(value) => updateAsset(asset.id, 'quantity', value || 1)}
                            min={1}
                            size="sm"
                            w={70}
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => removeAsset(asset.id)}
                            disabled={assets.length === 1}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                <Divider my="md" />

                {/* Action Buttons */}
                <Group justify="space-between">
                  <Button
                    type="button"
                    variant="light"
                    onClick={() => navigate("/dashboard/assets")}
                  >
                    Cancel
                  </Button>
                  
                  <Group gap="sm">
                    <Text size="sm" c="dimmed">
                      {filledAssetsCount} assets ready
                    </Text>
                    <Button
                      type="submit"
                      leftSection={<IconDeviceFloppy size={16} />}
                      disabled={!selectedRoomId || filledAssetsCount === 0}
                    >
                      Create All Assets
                    </Button>
                  </Group>
                </Group>
              </Form>
            </Stack>
          </Paper>

          {/* Common Asset Templates */}
          <Paper withBorder p="md" bg="gray.0">
            <Stack gap="xs">
              <Text fw={500} size="sm">💡 Common Asset Templates</Text>
              <Text size="sm" c="dimmed">
                <strong>Standard Room:</strong> Bed, TV, AC, Desk, Chair, Ceiling Light, Curtains
              </Text>
              <Text size="sm" c="dimmed">
                <strong>Deluxe Room:</strong> King Bed, Large TV, AC, Mini Fridge, Microwave, Coffee Maker, Safe
              </Text>
              <Text size="sm" c="dimmed">
                <strong>Bathroom:</strong> Shower Head, Mirror, Toilet Paper Holder, Towel Rack, Exhaust Fan
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </DashboardLayout>
  );
}
