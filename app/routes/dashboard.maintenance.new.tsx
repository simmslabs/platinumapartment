import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Title,
  Button,
  Stack,
  Group,
  Select,
  Textarea,
  NumberInput,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
  TextInput,
  Text,
} from "@mantine/core";
import { IconInfoCircle, IconTool } from "@tabler/icons-react";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { MaintenanceType, Priority } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "New Maintenance Task - Apartment Management" },
    { name: "description", content: "Create a new maintenance task" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const rooms = await db.room.findMany({
    select: { 
      id: true, 
      number: true, 
      type: {
        select: {
          displayName: true,
          name: true,
        },
      },
      block: true 
    },
    orderBy: { number: "asc" },
  });

  const assets = await db.roomAsset.findMany({
    select: {
      id: true,
      roomId: true,
      name: true,
      category: true,
      condition: true,
      room: {
        select: {
          number: true,
          block: true
        }
      }
    },
    orderBy: [
      { room: { number: "asc" } },
      { name: "asc" }
    ],
  });

  return json({ user, rooms, assets });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();

  try {
    const roomId = formData.get("roomId") as string;
    const assetId = formData.get("assetId") as string;
    const type = formData.get("type") as string;
    const description = formData.get("description") as string;
    const priority = formData.get("priority") as string;
    const reportedBy = formData.get("reportedBy") as string;
    const assignedTo = formData.get("assignedTo") as string;
    const cost = formData.get("cost") ? parseFloat(formData.get("cost") as string) : null;

    if (!roomId || !type || !description || !priority) {
      return json({ error: "All required fields must be filled" }, { status: 400 });
    }

      await db.maintenanceLog.create({
        data: {
          roomId,
          assetId: assetId || null,
          type: type as MaintenanceType,
          description,
          priority: priority as Priority,
          reportedBy: reportedBy || null,
          assignedTo: assignedTo || null,
          cost,
          status: "PENDING",
        },
      });    // Update room status to maintenance if it's a critical issue
    if (priority === "CRITICAL" || priority === "HIGH") {
      await db.room.update({
        where: { id: roomId },
        data: { status: "MAINTENANCE" },
      });
    }

    return redirect("/dashboard/maintenance");
  } catch (error) {
    console.error("Maintenance task creation error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function NewMaintenanceTask() {
  const { user, rooms, assets } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  // Filter assets based on selected room
  const filteredAssets = selectedRoomId 
    ? assets.filter(asset => asset.roomId === selectedRoomId)
    : [];

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Maintenance", href: "/dashboard/maintenance" },
    { title: "New Task", href: "#" },
  ].map((item, index) => (
    <Anchor href={item.href} key={index} c={index === 2 ? "dimmed" : "blue"}>
      {item.title}
    </Anchor>
  ));

  const maintenanceTypes = [
    { value: "CLEANING", label: "Cleaning" },
    { value: "REPAIR", label: "Repair" },
    { value: "INSPECTION", label: "Inspection" },
    { value: "UPGRADE", label: "Upgrade" },
    { value: "PREVENTIVE", label: "Preventive" },
  ];

  const priorityLevels = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "CRITICAL", label: "Critical" },
  ];

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>
        
        <Group justify="space-between">
          <Title order={2}>Create New Maintenance Task</Title>
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

        <Paper p="md" withBorder>
          <Form method="post">
            <Stack gap="md">
              <Select
                label="Room"
                placeholder="Select room"
                name="roomId"
                data={rooms.map(room => ({
                  value: room.id,
                  label: `Room ${room.number} (Block ${room.block}) - ${room.type.displayName}`
                }))}
                required
                searchable
                value={selectedRoomId}
                onChange={(value) => setSelectedRoomId(value || "")}
              />

              {selectedRoomId && filteredAssets.length > 0 && (
                <Select
                  label="Asset (Optional)"
                  placeholder="Select specific asset or leave blank for general room maintenance"
                  name="assetId"
                  data={filteredAssets.map(asset => ({
                    value: asset.id,
                    label: `${asset.name} (${asset.category.replace("_", " ")})`,
                    disabled: asset.condition === "BROKEN" || asset.condition === "MISSING"
                  }))}
                  searchable
                  clearable
                  description="Select a specific asset if the maintenance is for a particular item"
                  rightSection={
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">{filteredAssets.length} assets</Text>
                    </Group>
                  }
                />
              )}

              {selectedRoomId && filteredAssets.length === 0 && (
                <Alert color="blue" variant="light">
                  <Text size="sm">
                    No assets found in this room. The maintenance task will be for general room maintenance.
                  </Text>
                </Alert>
              )}

              <Group grow>
                <Select
                  label="Maintenance Type"
                  placeholder="Select type"
                  name="type"
                  data={maintenanceTypes}
                  required
                />
                <Select
                  label="Priority"
                  placeholder="Select priority"
                  name="priority"
                  data={priorityLevels}
                  required
                />
              </Group>

              <Textarea
                label="Description"
                placeholder="Describe the maintenance task in detail..."
                name="description"
                required
                rows={4}
              />

              <Group grow>
                <TextInput
                  label="Reported By"
                  placeholder="Staff member name"
                  name="reportedBy"
                />
                <TextInput
                  label="Assigned To"
                  placeholder="Maintenance staff"
                  name="assignedTo"
                />
              </Group>

              <NumberInput
                label="Estimated Cost (Optional)"
                placeholder="100.00"
                name="cost"
                min={0}
                prefix="₵"
                decimalScale={2}
                description="Leave blank if cost is unknown"
              />

              <Group justify="flex-end">
                <Button 
                  variant="light" 
                  onClick={() => navigate("/dashboard/maintenance")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  leftSection={<IconTool size={16} />}
                >
                  Create Task
                </Button>
              </Group>
            </Stack>
          </Form>
        </Paper>
      </Stack>
    </DashboardLayout>
  );
}
