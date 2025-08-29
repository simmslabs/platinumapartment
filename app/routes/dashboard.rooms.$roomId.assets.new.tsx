import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useActionData, useNavigate, MetaFunction } from "@remix-run/react";
import {
  Title,
  Text,
  Button,
  Stack,
  Group,
  NumberInput,
  Select,
  MultiSelect,
  Textarea,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle } from "@tabler/icons-react";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { AssetCondition } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Assign Asset - Apartment Management" },
    { name: "description", content: "Assign an existing asset to the room" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  const { roomId } = params;
  if (!roomId) {
    throw new Response("Room not found", { status: 404 });
  }

  const room = await db.room.findUnique({
    where: { id: roomId },
    include: {
      blockRelation: true,
      assets: {
        include: {
          asset: true,
        },
      },
    },
  });

  if (!room) {
    throw new Response("Room not found", { status: 404 });
  }

  // Get all existing assets
  const allAssets = await db.asset.findMany({
    orderBy: [
      { category: "asc" },
      { name: "asc" },
    ],
  });

  // Get currently assigned asset IDs and their configurations for this room
  const currentlyAssignedAssetIds = room.assets.map(ra => ra.assetId);
  const currentAssetConfigs = room.assets.reduce((acc, ra) => {
    acc[ra.assetId] = {
      quantity: ra.quantity,
      condition: ra.condition,
      notes: ra.notes || '',
    };
    return acc;
  }, {} as Record<string, { quantity: number; condition: string; notes: string }>);

  return json({ user, room, allAssets, currentlyAssignedAssetIds, currentAssetConfigs });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const { roomId } = params;
  
  if (!roomId) {
    return json({ error: "Room ID is required" }, { status: 400 });
  }

  const formData = await request.formData();
  const selectedAssetIds = formData.getAll("assetIds") as string[];

  console.log("Selected asset IDs:", selectedAssetIds);

  // Validate that all selected asset IDs exist
  if (selectedAssetIds.length > 0) {
    const existingAssets = await db.asset.findMany({
      where: { id: { in: selectedAssetIds } },
      select: { id: true },
    });
    
    const existingAssetIds = existingAssets.map(a => a.id);
    const invalidAssetIds = selectedAssetIds.filter(id => !existingAssetIds.includes(id));
    
    console.log("Existing asset IDs:", existingAssetIds);
    console.log("Invalid asset IDs:", invalidAssetIds);
    
    if (invalidAssetIds.length > 0) {
      return json({ error: `Invalid asset IDs: ${invalidAssetIds.join(', ')}` }, { status: 400 });
    }
  }

  try {
    // Get current room asset assignments
    const currentAssignments = await db.roomAsset.findMany({
      where: { roomId },
      select: { assetId: true },
    });
    
    const currentAssetIds = currentAssignments.map(ra => ra.assetId);
    
    // Determine assets to add and remove
    const assetsToAdd = selectedAssetIds.filter(id => !currentAssetIds.includes(id));
    const assetsToRemove = currentAssetIds.filter(id => !selectedAssetIds.includes(id));

    await db.$transaction(async (tx) => {
      // Remove unselected assets
      if (assetsToRemove.length > 0) {
        await tx.roomAsset.deleteMany({
          where: {
            roomId,
            assetId: { in: assetsToRemove },
          },
        });
      }

      // Add newly selected assets with individual quantities and conditions
      if (assetsToAdd.length > 0) {
        const createData = assetsToAdd.map(assetId => {
          const quantity = parseInt(formData.get(`quantity_${assetId}`) as string) || 1;
          const condition = formData.get(`condition_${assetId}`) as AssetCondition || "GOOD";
          const notes = formData.get(`notes_${assetId}`) as string || null;
          
          return {
            roomId,
            assetId,
            quantity,
            condition,
            notes,
          };
        });

        await tx.roomAsset.createMany({
          data: createData,
        });
      }
    });

    return redirect(`/dashboard/rooms/${roomId}`);
  } catch (error) {
    console.error("Error updating room assets:", error);
    return json({ error: "Failed to update room assets. Please try again." }, { status: 500 });
  }
}

export default function AddRoomAsset() {
  const { user, room, allAssets, currentlyAssignedAssetIds, currentAssetConfigs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(currentlyAssignedAssetIds);
  const [assetConfigs, setAssetConfigs] = useState<Record<string, { quantity: number; condition: string; notes: string }>>(currentAssetConfigs);

  const assetConditions = [
    { value: "EXCELLENT", label: "Excellent" },
    { value: "GOOD", label: "Good" },
    { value: "FAIR", label: "Fair" },
    { value: "POOR", label: "Poor" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "NEEDS_REPAIR", label: "Needs Repair" },
    { value: "OUT_OF_ORDER", label: "Out of Order" },
  ];

  // Prepare asset data for multiselect
  const assetSelectData = (allAssets || []).map(asset => ({
    value: asset.id,
    label: `${asset.name} (${asset.category.replace('_', ' ')})`,
  }));

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Breadcrumbs>
          <Anchor component="button" onClick={() => navigate("/dashboard/rooms")}>
            Rooms
          </Anchor>
          <Anchor component="button" onClick={() => navigate(`/dashboard/rooms/${room.id}`)}>
            Room {room.number}
          </Anchor>
          <Text>Manage Assets</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <div>
            <Title order={2}>Manage Room Assets</Title>
            <Text size="sm" c="dimmed">
              Assign or remove assets for Room {room.number} ({room.blockRelation ? room.blockRelation.name : room.block})
            </Text>
          </div>
          <Button 
            variant="light" 
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(`/dashboard/rooms/${room.id}`)}
          >
            Back to Room
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

        {allAssets.length === 0 && (
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="No Assets Available" 
            color="yellow"
            variant="light"
          >
            No assets exist in the system. You can create new assets from the Assets page.
          </Alert>
        )}

        {allAssets.length > 0 && (
          <Paper p="md" withBorder>
            <Form method="post">
              <Stack gap="md">
                <MultiSelect
                  label="Select Assets"
                  name="assetIds"
                  placeholder="Choose assets for this room"
                  data={assetSelectData}
                  value={selectedAssetIds}
                  onChange={(values) => {
                    setSelectedAssetIds(values);
                    // Initialize configs for newly added assets
                    const newConfigs = { ...assetConfigs };
                    values.forEach(assetId => {
                      if (!newConfigs[assetId]) {
                        newConfigs[assetId] = { quantity: 1, condition: 'GOOD', notes: '' };
                      }
                    });
                    setAssetConfigs(newConfigs);
                  }}
                  searchable
                  clearable
                  description="Select multiple assets to assign to this room. Configure each asset individually below."
                />

                {selectedAssetIds.length > 0 && (
                  <Stack gap="lg">
                    <Text size="sm" fw={500}>Configure Selected Assets:</Text>
                    {selectedAssetIds.map((assetId) => {
                      const asset = allAssets.find(a => a.id === assetId);
                      if (!asset) return null;
                      
                      const config = assetConfigs[assetId] || { quantity: 1, condition: 'GOOD', notes: '' };
                      
                      return (
                        <Paper key={assetId} p="sm" withBorder bg="gray.0">
                          <Stack gap="sm">
                            <Text size="sm" fw={500}>{asset.name} ({asset.category.replace('_', ' ')})</Text>
                            
                            <Group grow>
                              <NumberInput
                                label="Quantity"
                                name={`quantity_${assetId}`}
                                min={1}
                                value={config.quantity}
                                onChange={(value) => {
                                  setAssetConfigs(prev => ({
                                    ...prev,
                                    [assetId]: { ...config, quantity: Number(value) || 1 }
                                  }));
                                }}
                              />
                              <Select
                                label="Condition"
                                name={`condition_${assetId}`}
                                data={assetConditions}
                                value={config.condition}
                                onChange={(value) => {
                                  setAssetConfigs(prev => ({
                                    ...prev,
                                    [assetId]: { ...config, condition: value || 'GOOD' }
                                  }));
                                }}
                              />
                            </Group>
                            
                            <Textarea
                              label="Notes"
                              name={`notes_${assetId}`}
                              placeholder="Optional notes for this asset"
                              rows={2}
                              value={config.notes}
                              onChange={(event) => {
                                setAssetConfigs(prev => ({
                                  ...prev,
                                  [assetId]: { ...config, notes: event.currentTarget.value }
                                }));
                              }}
                            />
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}

                <Group justify="flex-end">
                  <Button 
                    variant="light" 
                    onClick={() => navigate(`/dashboard/rooms/${room.id}`)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    leftSection={<IconDeviceFloppy size={16} />}
                  >
                    Update Assets
                  </Button>
                </Group>
              </Stack>
            </Form>
          </Paper>
        )}
      </Stack>
    </DashboardLayout>
  );
}
