import type { 
  ActionFunctionArgs, 
  LoaderFunctionArgs, 
  MetaFunction 
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { 
  useLoaderData, 
  useActionData, 
  Form, 
  useNavigation,
  Link 
} from "@remix-run/react";
import {
  Title,
  Text,
  Button,
  Card,
  Group,
  Stack,
  TextInput,
  Select,
  Textarea,
  Container,
  Paper,
  ActionIcon,
  Alert,
  Divider,
  Badge,
  Flex,
  Box,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertTriangle,
  IconCalendar,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { useState } from "react";
import { format } from "date-fns";

export const meta: MetaFunction = () => {
  return [
    { title: "Edit Asset - Apartment Management" },
    { name: "description", content: "Edit asset details and information" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const { assetId } = params;

  if (!assetId) {
    throw new Response("Asset ID is required", { status: 400 });
  }

  // Get the asset with all its assignments and related data
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: {
      roomAssignments: {
        include: {
          room: {
            include: {
              type: {
                select: {
                  displayName: true,
                  name: true,
                },
              },
              blockRelation: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      },
      maintenance: {
        orderBy: { createdAt: "desc" },
        take: 5, // Get last 5 maintenance records
      },
    },
  });

  if (!asset) {
    throw new Response("Asset not found", { status: 404 });
  }

  return json({ user, asset });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  const { assetId } = params;

  if (!assetId) {
    return json({ error: "Asset ID is required" }, { status: 400 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const description = formData.get("description") as string;
  const serialNumber = formData.get("serialNumber") as string;
  const purchaseDate = formData.get("purchaseDate") as string;
  const warrantyExpiry = formData.get("warrantyExpiry") as string;
  const lastInspected = formData.get("lastInspected") as string;
  const notes = formData.get("notes") as string;

  // Validation
  if (!name?.trim()) {
    return json({ error: "Asset name is required" }, { status: 400 });
  }

  if (!category) {
    return json({ error: "Asset category is required" }, { status: 400 });
  }

  try {
    // Update the asset
    await db.asset.update({
      where: { id: assetId },
      data: {
        name: name.trim(),
        category: category as "FURNITURE" | "ELECTRONICS" | "BATHROOM" | "KITCHEN" | "BEDDING" | "LIGHTING" | "SAFETY" | "DECORATION" | "CLEANING" | "OTHER",
        description: description?.trim() || null,
        serialNumber: serialNumber?.trim() || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        lastInspected: lastInspected ? new Date(lastInspected) : null,
        notes: notes?.trim() || null,
      },
    });

    return redirect(`/dashboard/assets/${assetId}`);
  } catch (error) {
    console.error("Asset update error:", error);
    return json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export default function EditAsset() {
  const { user, asset } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // State for form fields
  const [formData, setFormData] = useState({
    name: asset.name,
    category: asset.category,
    description: asset.description || "",
    serialNumber: asset.serialNumber || "",
    purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : null,
    warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry) : null,
    lastInspected: asset.lastInspected ? new Date(asset.lastInspected) : null,
    notes: asset.notes || "",
  });

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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ELECTRONICS": return "📺";
      case "FURNITURE": return "🪑";
      case "BATHROOM": return "🚿";
      case "KITCHEN": return "🍽️";
      case "BEDDING": return "🛏️";
      case "LIGHTING": return "💡";
      case "SAFETY": return "🚨";
      case "DECORATION": return "🖼️";
      case "CLEANING": return "🧹";
      default: return "📦";
    }
  };

  return (
    <DashboardLayout user={user}>
      <Container size="lg">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="sm">
              <ActionIcon
                component={Link}
                to="/dashboard/assets"
                variant="light"
                size="lg"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <div>
                <Title order={2}>Edit Asset</Title>
                <Text c="dimmed">Update asset information and details</Text>
              </div>
            </Group>
            <Button
              component={Link}
              to={`/dashboard/assets/${asset.id}`}
              variant="light"
            >
              View Asset
            </Button>
          </Group>

          {/* Error Alert */}
          {actionData?.error && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red">
              {actionData.error}
            </Alert>
          )}

          <Flex gap="xl" align="flex-start">
            {/* Main Edit Form */}
            <Paper withBorder p="xl" flex={2}>
              <Form method="post">
                <Stack gap="md">
                  <Title order={4}>Asset Information</Title>
                  
                  {/* Asset Name */}
                  <TextInput
                    label="Asset Name"
                    name="name"
                    value={formData.name}
                    onChange={(event) => 
                      setFormData(prev => ({ ...prev, name: event.currentTarget.value }))
                    }
                    placeholder="e.g., King Size Bed, Samsung TV, Air Conditioner"
                    required
                    disabled={isSubmitting}
                  />

                  {/* Category */}
                  <Select
                    label="Category"
                    name="category"
                    value={formData.category}
                    onChange={(value) => 
                      setFormData(prev => ({ ...prev, category: value || "" }))
                    }
                    data={[
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
                    ]}
                    required
                    disabled={isSubmitting}
                  />

                  {/* Description */}
                  <Textarea
                    label="Description"
                    name="description"
                    value={formData.description}
                    onChange={(event) => 
                      setFormData(prev => ({ ...prev, description: event.currentTarget.value }))
                    }
                    placeholder="Additional details about the asset..."
                    minRows={3}
                    disabled={isSubmitting}
                  />

                  {/* Serial Number */}
                  <TextInput
                    label="Serial Number"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={(event) => 
                      setFormData(prev => ({ ...prev, serialNumber: event.currentTarget.value }))
                    }
                    placeholder="Asset serial number or identifier"
                    disabled={isSubmitting}
                  />

                  <Divider />

                  {/* Purchase Date */}
                  <DateInput
                    label="Purchase Date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={(value) => 
                      setFormData(prev => ({ ...prev, purchaseDate: value }))
                    }
                    placeholder="When was this asset purchased?"
                    leftSection={<IconCalendar size={16} />}
                    disabled={isSubmitting}
                  />

                  {/* Warranty Expiry */}
                  <DateInput
                    label="Warranty Expiry"
                    name="warrantyExpiry"
                    value={formData.warrantyExpiry}
                    onChange={(value) => 
                      setFormData(prev => ({ ...prev, warrantyExpiry: value }))
                    }
                    placeholder="When does the warranty expire?"
                    leftSection={<IconCalendar size={16} />}
                    disabled={isSubmitting}
                  />

                  {/* Last Inspected */}
                  <DateInput
                    label="Last Inspected"
                    name="lastInspected"
                    value={formData.lastInspected}
                    onChange={(value) => 
                      setFormData(prev => ({ ...prev, lastInspected: value }))
                    }
                    placeholder="When was this asset last inspected?"
                    leftSection={<IconCalendar size={16} />}
                    disabled={isSubmitting}
                  />

                  <Divider />

                  {/* Notes */}
                  <Textarea
                    label="Notes"
                    name="notes"
                    value={formData.notes}
                    onChange={(event) => 
                      setFormData(prev => ({ ...prev, notes: event.currentTarget.value }))
                    }
                    placeholder="Maintenance notes, observations, or special instructions..."
                    minRows={4}
                    disabled={isSubmitting}
                  />

                  {/* Submit Button */}
                  <Group justify="flex-end" mt="xl">
                    <Button
                      component={Link}
                      to="/dashboard/assets"
                      variant="light"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      leftSection={<IconDeviceFloppy size={16} />}
                      loading={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                  </Group>
                </Stack>
              </Form>
            </Paper>

            {/* Asset Summary Sidebar */}
            <Box flex={1}>
              <Stack gap="md">
                {/* Current Asset Summary */}
                <Card withBorder p="md">
                  <Group gap="sm" mb="sm">
                    <Text span>{getCategoryIcon(asset.category)}</Text>
                    <Badge variant="light" color="blue">
                      {asset.category}
                    </Badge>
                  </Group>
                  <Text fw={500} mb="xs">{asset.name}</Text>
                  {asset.description && (
                    <Text size="sm" c="dimmed" mb="sm">{asset.description}</Text>
                  )}
                  
                  <Stack gap="xs">
                    {asset.serialNumber && (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>Serial:</Text>
                        <Text size="sm" c="dimmed">{asset.serialNumber}</Text>
                      </Group>
                    )}
                    {asset.purchaseDate && (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>Purchased:</Text>
                        <Text size="sm" c="dimmed">
                          {format(new Date(asset.purchaseDate), "MMM dd, yyyy")}
                        </Text>
                      </Group>
                    )}
                    {asset.lastInspected && (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>Last Inspected:</Text>
                        <Text size="sm" c="dimmed">
                          {format(new Date(asset.lastInspected), "MMM dd, yyyy")}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Card>

                {/* Room Assignments */}
                <Card withBorder p="md">
                  <Group justify="space-between" mb="sm">
                    <Text fw={500}>Room Assignments</Text>
                    {asset.roomAssignments.length > 2 && (
                      <Text size="xs" c="dimmed">
                        +{asset.roomAssignments.length - 2} more
                      </Text>
                    )}
                  </Group>
                  {asset.roomAssignments.length === 0 ? (
                    <Text size="sm" c="dimmed">Not assigned to any room</Text>
                  ) : (
                    <Stack gap="xs">
                      {asset.roomAssignments.slice(0, 2).map((assignment) => (
                        <Group key={assignment.id} justify="space-between" align="center">
                          <Text size="sm" fw={500}>
                            Room {assignment.room.number} ({assignment.quantity})
                          </Text>
                          <Badge 
                            size="xs" 
                            color={getConditionColor(assignment.condition)}
                          >
                            {assignment.condition}
                          </Badge>
                        </Group>
                      ))}
                      {asset.roomAssignments.length > 2 && (
                        <Text size="xs" c="dimmed" ta="center">
                          View asset details for all assignments
                        </Text>
                      )}
                    </Stack>
                  )}
                </Card>

                {/* Recent Maintenance */}
                {asset.maintenance.length > 0 && (
                  <Card withBorder p="md">
                    <Text fw={500} mb="sm">Recent Maintenance</Text>
                    <Stack gap="xs">
                      {asset.maintenance.slice(0, 3).map((log) => (
                        <div key={log.id}>
                          <Text size="sm" fw={500}>
                            {log.type}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {format(new Date(log.createdAt), "MMM dd, yyyy")}
                          </Text>
                        </div>
                      ))}
                    </Stack>
                  </Card>
                )}
              </Stack>
            </Box>
          </Flex>
        </Stack>
      </Container>
    </DashboardLayout>
  );
}
