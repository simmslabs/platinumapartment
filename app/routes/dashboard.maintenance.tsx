import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  Select,
  Textarea,
  NumberInput,
  Alert,
  Text,
  Card,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconInfoCircle, IconTool } from "@tabler/icons-react";
import { format } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { MaintenanceLog, Room } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Maintenance - Apartment Management" },
    { name: "description", content: "Manage apartment maintenance tasks" },
  ];
};

type MaintenanceWithRoom = MaintenanceLog & {
  room: Pick<Room, "number" | "type">;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const maintenanceLogs = await db.maintenanceLog.findMany({
    include: {
      room: {
        select: { number: true, type: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rooms = await db.room.findMany({
    select: { id: true, number: true, type: true },
    orderBy: { number: "asc" },
  });

  return json({ user, maintenanceLogs, rooms });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const roomId = formData.get("roomId") as string;
      const type = formData.get("type") as any;
      const description = formData.get("description") as string;
      const priority = formData.get("priority") as any;
      const reportedBy = formData.get("reportedBy") as string;
      const assignedTo = formData.get("assignedTo") as string;
      const cost = formData.get("cost") ? parseFloat(formData.get("cost") as string) : null;

      if (!roomId || !type || !description || !priority) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }

      await db.maintenanceLog.create({
        data: {
          roomId,
          type,
          description,
          priority,
          reportedBy: reportedBy || null,
          assignedTo: assignedTo || null,
          cost,
          status: "PENDING",
        },
      });

      // Update room status to maintenance if it's a critical issue
      if (priority === "CRITICAL" || priority === "HIGH") {
        await db.room.update({
          where: { id: roomId },
          data: { status: "MAINTENANCE" },
        });
      }

      return json({ success: "Maintenance task created successfully" });
    }

    if (intent === "update-status") {
      const maintenanceId = formData.get("maintenanceId") as string;
      const status = formData.get("status") as any;

      const updateData: any = { status };
      
      if (status === "IN_PROGRESS") {
        updateData.startDate = new Date();
      } else if (status === "COMPLETED") {
        updateData.endDate = new Date();
      }

      const maintenanceLog = await db.maintenanceLog.update({
        where: { id: maintenanceId },
        data: updateData,
        include: { room: true },
      });

      // Update room status when maintenance is completed
      if (status === "COMPLETED") {
        await db.room.update({
          where: { id: maintenanceLog.roomId },
          data: { status: "AVAILABLE" },
        });
      }

      return json({ success: "Maintenance status updated successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Maintenance action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Maintenance() {
  const { user, maintenanceLogs, rooms } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);

  const getStatusColor = (status: MaintenanceLog["status"]) => {
    switch (status) {
      case "PENDING":
        return "yellow";
      case "IN_PROGRESS":
        return "blue";
      case "COMPLETED":
        return "green";
      case "CANCELLED":
        return "red";
      default:
        return "gray";
    }
  };

  const getPriorityColor = (priority: MaintenanceLog["priority"]) => {
    switch (priority) {
      case "LOW":
        return "green";
      case "MEDIUM":
        return "yellow";
      case "HIGH":
        return "orange";
      case "CRITICAL":
        return "red";
      default:
        return "gray";
    }
  };

  const getTypeIcon = (type: MaintenanceLog["type"]) => {
    return <IconTool size={16} />;
  };

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Maintenance Management</Title>
          {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              New Maintenance Task
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

        <Card>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Room</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Description</Table.Th>
                <Table.Th>Priority</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Reported</Table.Th>
                <Table.Th>Cost</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {maintenanceLogs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>
                    <div>
                      <Text fw={500}>Room {log.room.number}</Text>
                      <Text size="sm" c="dimmed">
                        {log.room.type.replace("_", " ")}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getTypeIcon(log.type)}
                      <Text size="sm">
                        {log.type.replace("_", " ")}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {log.description}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getPriorityColor(log.priority)} size="sm">
                      {log.priority}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(log.status)} size="sm">
                      {log.status.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text size="sm">
                        {format(new Date(log.createdAt), "MMM dd, yyyy")}
                      </Text>
                      {log.reportedBy && (
                        <Text size="xs" c="dimmed">
                          by {log.reportedBy}
                        </Text>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    {log.cost ? `₵${log.cost}` : "N/A"}
                  </Table.Td>
                  <Table.Td>
                    {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="update-status" />
                        <input type="hidden" name="maintenanceId" value={log.id} />
                        <Select
                          name="status"
                          size="xs"
                          data={[
                            { value: "PENDING", label: "Pending" },
                            { value: "IN_PROGRESS", label: "In Progress" },
                            { value: "COMPLETED", label: "Completed" },
                            { value: "CANCELLED", label: "Cancelled" },
                          ]}
                          defaultValue={log.status}
                          onChange={(value) => {
                            if (value) {
                              const form = new FormData();
                              form.append("intent", "update-status");
                              form.append("maintenanceId", log.id);
                              form.append("status", value);
                              fetch("/dashboard/maintenance", {
                                method: "POST",
                                body: form,
                              }).then(() => window.location.reload());
                            }
                          }}
                        />
                      </Form>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        </Card>

        <Modal opened={opened} onClose={close} title="Create Maintenance Task" size="lg">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Stack>
              <Select
                label="Room"
                placeholder="Select room"
                name="roomId"
                data={rooms.map(room => ({
                  value: room.id,
                  label: `Room ${room.number} (Block ${room.block}) - ${room.type.replace("_", " ")}`
                }))}
                required
                searchable
              />

              <Select
                label="Maintenance Type"
                placeholder="Select type"
                name="type"
                data={[
                  { value: "CLEANING", label: "Cleaning" },
                  { value: "REPAIR", label: "Repair" },
                  { value: "INSPECTION", label: "Inspection" },
                  { value: "UPGRADE", label: "Upgrade" },
                  { value: "PREVENTIVE", label: "Preventive" },
                ]}
                required
              />

              <Textarea
                label="Description"
                placeholder="Describe the maintenance task..."
                name="description"
                required
                rows={3}
              />

              <Select
                label="Priority"
                placeholder="Select priority"
                name="priority"
                data={[
                  { value: "LOW", label: "Low" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "HIGH", label: "High" },
                  { value: "CRITICAL", label: "Critical" },
                ]}
                required
              />

              <Group grow>
                <Textarea
                  label="Reported By"
                  placeholder="Staff member name"
                  name="reportedBy"
                  rows={1}
                />
                <Textarea
                  label="Assigned To"
                  placeholder="Maintenance staff"
                  name="assignedTo"
                  rows={1}
                />
              </Group>

              <NumberInput
                label="Estimated Cost"
                placeholder="100"
                name="cost"
                min={0}
                prefix="₵"
                decimalScale={2}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" onClick={close}>
                  Create Task
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
