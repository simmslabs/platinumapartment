import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate, Outlet, useLocation } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Select,
  Alert,
  Text,
  Card,
  TextInput,
  ActionIcon,
  Modal,
  Paper,
  Menu,
} from "@mantine/core";
import { IconPlus, IconInfoCircle, IconTool, IconTrash, IconSearch, IconFilter, IconDots } from "@tabler/icons-react";
import { format } from "date-fns";
import  DashboardLayout   from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { MaintenanceLog, MaintenanceStatus } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Maintenance - Apartment Management" },
    { name: "description", content: "Manage apartment maintenance tasks" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  const maintenanceLogs = await db.maintenanceLog.findMany({
    include: {
      room: {
        select: { 
          number: true, 
          type: {
            select: {
              displayName: true,
              name: true,
            },
          },
        },
      },
      asset: {
        select: { 
          name: true, 
          category: true,
          description: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ user, maintenanceLogs });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "update-status") {
      const maintenanceId = formData.get("maintenanceId") as string;
      const status = formData.get("status") as MaintenanceStatus;

      const updateData: { status: MaintenanceStatus; startDate?: Date; endDate?: Date } = { status };
      
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

    if (intent === "delete") {
      const maintenanceId = formData.get("maintenanceId") as string;

      if (!maintenanceId) {
        return json({ error: "Maintenance ID is required" }, { status: 400 });
      }

      // Get the maintenance log to check if it's safe to delete
      const maintenanceLog = await db.maintenanceLog.findUnique({
        where: { id: maintenanceId },
        include: { room: true },
      });

      if (!maintenanceLog) {
        return json({ error: "Maintenance task not found" }, { status: 404 });
      }

      // Only allow deletion if the task is PENDING or CANCELLED
      if (maintenanceLog.status === "IN_PROGRESS" || maintenanceLog.status === "COMPLETED") {
        return json({ 
          error: "Cannot delete maintenance tasks that are in progress or completed" 
        }, { status: 400 });
      }

      await db.maintenanceLog.delete({
        where: { id: maintenanceId },
      });

      return json({ success: "Maintenance task deleted successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Maintenance action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Maintenance() {
  const { user, maintenanceLogs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const location = useLocation();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    logId: string;
    canDelete: boolean;
  }>({ isOpen: false, logId: "", canDelete: false });

  // Close delete modal on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData) {
      setDeleteConfirm({ isOpen: false, logId: "", canDelete: false });
    }
  }, [actionData]);

  // Filter logic
  const filteredLogs = maintenanceLogs.filter((log) => {
    const matchesSearch = 
      searchTerm === "" ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.room.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.asset?.name && log.asset.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.reportedBy && log.reportedBy.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "" || log.status === statusFilter;
    const matchesPriority = priorityFilter === "" || log.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

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

  if(location.pathname !== "/dashboard/maintenance") return <Outlet />

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Maintenance Management</Title>
          <Group>
            <Button 
              variant="light"
              leftSection={<IconFilter size={16} />} 
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
            {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "STAFF") && (
              <Button 
                leftSection={<IconPlus size={16} />} 
                onClick={() => navigate("/dashboard/maintenance/new")}
              >
                New Maintenance Task
              </Button>
            )}
          </Group>
        </Group>

        {showFilters && (
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group grow>
                <TextInput
                  placeholder="Search by description, room, asset, or reporter..."
                  leftSection={<IconSearch size={16} />}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.currentTarget.value)}
                />
                <Select
                  placeholder="Filter by status"
                  data={[
                    { value: "", label: "All Statuses" },
                    { value: "PENDING", label: "Pending" },
                    { value: "IN_PROGRESS", label: "In Progress" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "CANCELLED", label: "Cancelled" },
                  ]}
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value || "")}
                />
                <Select
                  placeholder="Filter by priority"
                  data={[
                    { value: "", label: "All Priorities" },
                    { value: "LOW", label: "Low" },
                    { value: "MEDIUM", label: "Medium" },
                    { value: "HIGH", label: "High" },
                    { value: "CRITICAL", label: "Critical" },
                  ]}
                  value={priorityFilter}
                  onChange={(value) => setPriorityFilter(value || "")}
                />
              </Group>
              <Text size="sm" c="dimmed">
                Showing {filteredLogs.length} of {maintenanceLogs.length} maintenance tasks
              </Text>
            </Stack>
          </Paper>
        )}

        {actionData && 'error' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData && 'success' in actionData && (
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
                  <Table.Th>Asset</Table.Th>
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
              {filteredLogs.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}>
                    {searchTerm || statusFilter || priorityFilter 
                      ? "No maintenance tasks match your filters"
                      : "No maintenance tasks found"}
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredLogs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>
                    <div>
                      <Text fw={500}>Room {log.room.number}</Text>
                      <Text size="sm" c="dimmed">
                        {log.room.type.displayName}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    {log.asset ? (
                      <div>
                        <Text size="sm" fw={500}>
                          {log.asset.name}
                        </Text>
                        <Badge size="xs" variant="light" color={
                          log.asset.category === "ELECTRONICS" ? "cyan" :
                          log.asset.category === "FURNITURE" ? "brown" :
                          log.asset.category === "BATHROOM" ? "blue" :
                          log.asset.category === "KITCHEN" ? "orange" :
                          log.asset.category === "BEDDING" ? "pink" :
                          log.asset.category === "LIGHTING" ? "yellow" :
                          log.asset.category === "SAFETY" ? "red" :
                          log.asset.category === "DECORATION" ? "grape" :
                          log.asset.category === "CLEANING" ? "green" : "gray"
                        }>
                          {log.asset.category.replace("_", " ")}
                        </Badge>
                      </div>
                    ) : (
                      <Text size="sm" c="dimmed" fs="italic">
                        General Room
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconTool size={16} />
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
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="light" color="gray">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <Menu.Label>Status</Menu.Label>
                          <Menu.Item
                            onClick={() => {
                              const form = new FormData();
                              form.append("intent", "update-status");
                              form.append("maintenanceId", log.id);
                              form.append("status", "PENDING");
                              fetch("/dashboard/maintenance", {
                                method: "POST",
                                body: form,
                              }).then(() => window.location.reload());
                            }}
                            disabled={log.status === "PENDING"}
                          >
                            Mark as Pending
                          </Menu.Item>
                          <Menu.Item
                            onClick={() => {
                              const form = new FormData();
                              form.append("intent", "update-status");
                              form.append("maintenanceId", log.id);
                              form.append("status", "IN_PROGRESS");
                              fetch("/dashboard/maintenance", {
                                method: "POST",
                                body: form,
                              }).then(() => window.location.reload());
                            }}
                            disabled={log.status === "IN_PROGRESS"}
                          >
                            Mark as In Progress
                          </Menu.Item>
                          <Menu.Item
                            onClick={() => {
                              const form = new FormData();
                              form.append("intent", "update-status");
                              form.append("maintenanceId", log.id);
                              form.append("status", "COMPLETED");
                              fetch("/dashboard/maintenance", {
                                method: "POST",
                                body: form,
                              }).then(() => window.location.reload());
                            }}
                            disabled={log.status === "COMPLETED"}
                          >
                            Mark as Completed
                          </Menu.Item>
                          <Menu.Item
                            onClick={() => {
                              const form = new FormData();
                              form.append("intent", "update-status");
                              form.append("maintenanceId", log.id);
                              form.append("status", "CANCELLED");
                              fetch("/dashboard/maintenance", {
                                method: "POST",
                                body: form,
                              }).then(() => window.location.reload());
                            }}
                            disabled={log.status === "CANCELLED"}
                          >
                            Mark as Cancelled
                          </Menu.Item>

                          <Menu.Divider />

                          <Menu.Label>Actions</Menu.Label>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => {
                              setDeleteConfirm({ 
                                isOpen: true, 
                                logId: log.id, 
                                canDelete: log.status === "PENDING" || log.status === "CANCELLED" 
                              });
                            }}
                          >
                            Delete Task
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                </Table.Tr>
              )))}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        </Card>

        <Modal
          opened={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, logId: "", canDelete: false })}
          title="Delete Maintenance Task"
          centered
        >
          <Stack gap="md">
            <Text>
              {deleteConfirm.canDelete
                ? "Are you sure you want to delete this maintenance task? This action cannot be undone."
                : "This maintenance task cannot be deleted because it's currently in progress or completed. Only pending tasks can be deleted."}
            </Text>
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => setDeleteConfirm({ isOpen: false, logId: "", canDelete: false })}
              >
                Cancel
              </Button>
              {deleteConfirm.canDelete && (
                <Form method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="maintenanceId" value={deleteConfirm.logId} />
                  <Button
                    type="submit"
                    color="red"
                  >
                    Delete
                  </Button>
                </Form>
              )}
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
