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
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle } from "@tabler/icons-react";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { AssetCategory, AssetCondition } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Add New Asset - Apartment Management" },
    { name: "description", content: "Add a new asset to the room" },
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
    },
  });

  if (!room) {
    throw new Response("Room not found", { status: 404 });
  }

  return json({ user, room });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const { roomId } = params;
  
  if (!roomId) {
    return json({ error: "Room ID is required" }, { status: 400 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const category = formData.get("category") as AssetCategory;
  const quantity = parseInt(formData.get("quantity") as string);
  const condition = formData.get("condition") as AssetCondition;
  const description = formData.get("description") as string;
  const serialNumber = formData.get("serialNumber") as string;
  const notes = formData.get("notes") as string;

  // Validate required fields
  if (!name || !category || !quantity || !condition) {
    return json({ error: "Name, category, quantity, and condition are required" }, { status: 400 });
  }

  try {
    await db.roomAsset.create({
      data: {
        roomId,
        name,
        category,
        quantity,
        condition,
        description: description || null,
        serialNumber: serialNumber || null,
        notes: notes || null,
        lastInspected: new Date(),
      },
    });

    return redirect(`/dashboard/rooms/${roomId}`);
  } catch (error) {
    console.error("Error creating asset:", error);
    return json({ error: "Failed to create asset. Please try again." }, { status: 500 });
  }
}

export default function AddRoomAsset() {
  const { user, room } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const assetCategories = [
    { value: "FURNITURE", label: "Furniture" },
    { value: "ELECTRONICS", label: "Electronics" },
    { value: "BATHROOM", label: "Bathroom" },
    { value: "KITCHEN", label: "Kitchen" },
    { value: "BEDDING", label: "Bedding" },
    { value: "LIGHTING", label: "Lighting" },
    { value: "SAFETY", label: "Safety" },
    { value: "DECORATION", label: "Decoration" },
    { value: "CLEANING", label: "Cleaning" },
    { value: "OTHER", label: "Other" },
  ];

  const assetConditions = [
    { value: "EXCELLENT", label: "Excellent" },
    { value: "GOOD", label: "Good" },
    { value: "FAIR", label: "Fair" },
    { value: "POOR", label: "Poor" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "BROKEN", label: "Broken" },
    { value: "MISSING", label: "Missing" },
  ];

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
          <Text>Add Asset</Text>
        </Breadcrumbs>

        <Group justify="space-between">
          <div>
            <Title order={2}>Add New Asset</Title>
            <Text size="sm" c="dimmed">
              Add a new asset to Room {room.number} ({room.blockRelation ? room.blockRelation.name : room.block})
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

        <Paper p="md" withBorder>
          <Form method="post">
            <Stack gap="md">
              <Group grow>
                <TextInput
                  label="Asset Name"
                  name="name"
                  placeholder="e.g., King Size Bed, 55-inch TV"
                  required
                />
                <Select
                  label="Category"
                  name="category"
                  placeholder="Select category"
                  data={assetCategories}
                  required
                />
              </Group>

              <Group grow>
                <NumberInput
                  label="Quantity"
                  name="quantity"
                  placeholder="1"
                  min={1}
                  defaultValue={1}
                  required
                />
                <Select
                  label="Condition"
                  name="condition"
                  placeholder="Select condition"
                  data={assetConditions}
                  defaultValue="GOOD"
                  required
                />
              </Group>

              <TextInput
                label="Serial Number"
                name="serialNumber"
                placeholder="Optional serial number or identifier"
              />

              <Textarea
                label="Description"
                name="description"
                placeholder="Optional description of the asset"
                rows={3}
              />

              <Textarea
                label="Notes"
                name="notes"
                placeholder="Optional maintenance notes or observations"
                rows={2}
              />

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
                  Add Asset
                </Button>
              </Group>
            </Stack>
          </Form>
        </Paper>
      </Stack>
    </DashboardLayout>
  );
}
