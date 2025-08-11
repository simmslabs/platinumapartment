import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { useState } from "react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  TextInput,
  Alert,
  Text,
  Card,
  ActionIcon,
  NumberInput,
  Textarea,
  Select,
  Switch,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconInfoCircle, IconTrash, IconEdit, IconBuildingStore } from "@tabler/icons-react";
import { format } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { Service, ServiceCategory } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Services - Apartment Management" },
    { name: "description", content: "Manage apartment services and amenities" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const services = await db.service.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return json({ user, services });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Only ADMIN, MANAGER, and STAFF can manage services
  if (!user || !["ADMIN", "MANAGER", "STAFF"].includes(user.role)) {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const price = parseFloat(formData.get("price") as string);
      const category = formData.get("category") as ServiceCategory;
      const isActive = formData.get("isActive") === "true";

      if (!name || !description || !price || !category) {
        return json({ error: "Name, description, price, and category are required" }, { status: 400 });
      }

      await db.service.create({
        data: {
          name,
          description,
          price,
          category,
          isActive,
        },
      });

      return json({ success: "Service created successfully" });
    }

    if (intent === "update") {
      const id = formData.get("id") as string;
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const price = parseFloat(formData.get("price") as string);
      const category = formData.get("category") as ServiceCategory;
      const isActive = formData.get("isActive") === "true";

      if (!id || !name || !description || !price || !category) {
        return json({ error: "All fields are required" }, { status: 400 });
      }

      await db.service.update({
        where: { id },
        data: {
          name,
          description,
          price,
          category,
          isActive,
        },
      });

      return json({ success: "Service updated successfully" });
    }

    if (intent === "delete") {
      const id = formData.get("id") as string;

      if (!id) {
        return json({ error: "Service ID is required" }, { status: 400 });
      }

      // Check if service has any bookings
      const serviceWithBookings = await db.service.findUnique({
        where: { id },
        include: {
          _count: {
            select: { serviceBookings: true }
          }
        }
      });

      if (serviceWithBookings && serviceWithBookings._count.serviceBookings > 0) {
        return json({ error: "Cannot delete service with existing bookings" }, { status: 400 });
      }

      await db.service.delete({
        where: { id },
      });

      return json({ success: "Service deleted successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Service action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Services() {
  const { user, services } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const getCategoryColor = (category: ServiceCategory) => {
    switch (category) {
      case "LAUNDRY":
        return "blue";
      case "FOOD":
        return "green";
      case "TRANSPORT":
        return "orange";
      case "SPA":
        return "purple";
      case "CLEANING":
        return "cyan";
      case "OTHER":
        return "gray";
      default:
        return "gray";
    }
  };

  const getCategoryLabel = (category: ServiceCategory) => {
    switch (category) {
      case "LAUNDRY":
        return "Laundry";
      case "FOOD":
        return "Food & Dining";
      case "TRANSPORT":
        return "Transportation";
      case "SPA":
        return "Spa & Wellness";
      case "CLEANING":
        return "Cleaning";
      case "OTHER":
        return "Other";
      default:
        return category;
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    open();
  };

  const handleDelete = (serviceId: string) => {
    if (confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
      const form = new FormData();
      form.append("intent", "delete");
      form.append("id", serviceId);
      fetch("/dashboard/services", {
        method: "POST",
        body: form,
      }).then(() => window.location.reload());
    }
  };

  const handleModalClose = () => {
    setEditingService(null);
    close();
  };

  const canManageServices = user?.role && ["ADMIN", "MANAGER", "STAFF"].includes(user.role);

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Services Management</Title>
          {canManageServices && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Add Service
            </Button>
          )}
        </Group>

        {actionData?.error && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData?.success && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
            variant="light"
          >
            {actionData.success}
          </Alert>
        )}

        <Card withBorder>
          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Service</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  {canManageServices && <Table.Th>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {services.map((service) => (
                  <Table.Tr key={service.id}>
                    <Table.Td>
                      <div>
                        <Text fw={500}>{service.name}</Text>
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {service.description}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getCategoryColor(service.category)} size="sm">
                        {getCategoryLabel(service.category)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>₵{service.price.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={service.isActive ? "green" : "red"} size="sm">
                        {service.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {format(new Date(service.createdAt), "MMM dd, yyyy")}
                      </Text>
                    </Table.Td>
                    {canManageServices && (
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => handleEdit(service)}
                            title="Edit service"
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          {user?.role === "ADMIN" && (
                            <ActionIcon
                              color="red"
                              variant="light"
                              size="sm"
                              onClick={() => handleDelete(service.id)}
                              title="Delete service"
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
                {services.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={canManageServices ? 6 : 5}>
                      <Stack align="center" py="xl">
                        <IconBuildingStore size={48} color="gray" />
                        <Text c="dimmed" ta="center">
                          No services configured yet
                        </Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>

        <Modal 
          opened={opened} 
          onClose={handleModalClose} 
          title={editingService ? "Edit Service" : "Add Service"} 
          size="lg"
        >
          <Form method="post">
            <input type="hidden" name="intent" value={editingService ? "update" : "create"} />
            {editingService && <input type="hidden" name="id" value={editingService.id} />}
            <Stack>
              <TextInput
                label="Service Name"
                placeholder="e.g., Laundry Service"
                name="name"
                defaultValue={editingService?.name || ""}
                required
              />

              <Textarea
                label="Description"
                placeholder="Describe the service..."
                name="description"
                defaultValue={editingService?.description || ""}
                rows={3}
                required
              />

              <Select
                label="Category"
                placeholder="Select service category"
                name="category"
                defaultValue={editingService?.category || ""}
                data={[
                  { value: "LAUNDRY", label: "Laundry" },
                  { value: "FOOD", label: "Food & Dining" },
                  { value: "TRANSPORT", label: "Transportation" },
                  { value: "SPA", label: "Spa & Wellness" },
                  { value: "CLEANING", label: "Cleaning" },
                  { value: "OTHER", label: "Other" },
                ]}
                required
              />

              <NumberInput
                label="Price (₵)"
                placeholder="0.00"
                name="price"
                defaultValue={editingService?.price || 0}
                min={0}
                step={0.01}
                decimalScale={2}
                required
              />

              <Switch
                label="Active Service"
                name="isActive"
                defaultChecked={editingService?.isActive ?? true}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button type="submit" onClick={handleModalClose}>
                  {editingService ? "Update Service" : "Create Service"}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
