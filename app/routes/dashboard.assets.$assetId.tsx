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
  Breadcrumbs,
  Anchor,
  Card,
  Badge,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle, IconCalendar } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { AssetCategory, AssetCondition } from "@prisma/client";
import { format } from "date-fns";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const assetName = data?.asset?.name || "Unknown";
  return [
    { title: `${assetName} - Asset Details - Apartment Management` },
    { name: "description", content: `View and edit details for ${assetName}` },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  const { assetId } = params;
  if (!assetId) {
    throw new Response("Asset not found", { status: 404 });
  }

  const asset = await db.roomAsset.findUnique({
    where: { id: assetId },
    include: {
      room: {
        include: {
          type: {
            select: {
              displayName: true,
              name: true,
            },
          },
          blockRelation: true,
        },
      },
      maintenance: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
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
    throw new Response("Asset not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update") {
    const name = formData.get("name") as string;
    const category = formData.get("category") as AssetCategory;
    const condition = formData.get("condition") as AssetCondition;
    const quantity = parseInt(formData.get("quantity") as string);
    const description = formData.get("description") as string || null;
    const serialNumber = formData.get("serialNumber") as string || null;
    const notes = formData.get("notes") as string || null;

    // Validation
    if (!name || !category || !condition || isNaN(quantity) || quantity < 1) {
      return json({
        error: "Please fill in all required fields with valid values.",
      }, { status: 400 });
    }

    try {
      await db.roomAsset.update({
        where: { id: assetId },
        data: {
          name,
          category,
          condition,
          quantity,
          description,
          serialNumber,
          notes,
          updatedAt: new Date(),
        },
      });

      return redirect(`/dashboard/assets/${assetId}?updated=true`);
    } catch (error) {
      console.error("Error updating asset:", error);
      return json({
        error: "Failed to update asset. Please try again.",
      }, { status: 500 });
    }
  }

  if (intent === "inspect") {
    try {
      await db.roomAsset.update({
        where: { id: assetId },
        data: {
          lastInspected: new Date(),
          updatedAt: new Date(),
        },
      });

      return redirect(`/dashboard/assets/${assetId}?inspected=true`);
    } catch (error) {
      console.error("Error updating inspection date:", error);
      return json({
        error: "Failed to update inspection date. Please try again.",
      }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function AssetDetails() {
  const { user, asset } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

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
              <Title order={2}>{asset.name}</Title>
              <Breadcrumbs>
                <Anchor component="button" onClick={() => navigate("/dashboard/assets")}>
                  Assets
                </Anchor>
                <Anchor component="button" onClick={() => navigate(`/dashboard/rooms/${asset.roomId}`)}>
                  Room {asset.room.number}
                </Anchor>
                <Text>{asset.name}</Text>
              </Breadcrumbs>
            </div>
          </Group>
          <Badge size="lg" color={getConditionColor(asset.condition)}>
            {asset.condition}
          </Badge>
        </Group>

        {/* Success/Error Messages */}
        {new URLSearchParams(window.location.search).get("updated") === "true" && (
          <Alert color="green">
            Asset updated successfully!
          </Alert>
        )}
        
        {new URLSearchParams(window.location.search).get("inspected") === "true" && (
          <Alert color="blue">
            Asset inspection date updated!
          </Alert>
        )}

        {actionData?.error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {actionData.error}
          </Alert>
        )}

        <Group gap="lg" align="flex-start">
          {/* Asset Information */}
          <Card withBorder p="lg" style={{ flex: 1 }}>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3}>Asset Information</Title>
                <Text>{getCategoryIcon(asset.category)}</Text>
              </Group>

              <Group gap="xs">
                <Text fw={500}>Category:</Text>
                <Badge variant="light">
                  {asset.category.replace('_', ' ')}
                </Badge>
              </Group>

              <Group gap="xs">
                <Text fw={500}>Quantity:</Text>
                <Text>{asset.quantity}</Text>
              </Group>

              {asset.serialNumber && (
                <Group gap="xs">
                  <Text fw={500}>Serial Number:</Text>
                  <Text ff="monospace">{asset.serialNumber}</Text>
                </Group>
              )}

              {asset.description && (
                <div>
                  <Text fw={500} mb="xs">Description:</Text>
                  <Text size="sm" c="dimmed">{asset.description}</Text>
                </div>
              )}

              {asset.purchaseDate && (
                <Group gap="xs">
                  <Text fw={500}>Purchase Date:</Text>
                  <Text>{format(new Date(asset.purchaseDate), "MMM dd, yyyy")}</Text>
                </Group>
              )}

              {asset.warrantyExpiry && (
                <Group gap="xs">
                  <Text fw={500}>Warranty Expires:</Text>
                  <Text>{format(new Date(asset.warrantyExpiry), "MMM dd, yyyy")}</Text>
                </Group>
              )}

              <Group gap="xs">
                <Text fw={500}>Last Inspected:</Text>
                <Text>
                  {asset.lastInspected 
                    ? format(new Date(asset.lastInspected), "MMM dd, yyyy")
                    : "Never"
                  }
                </Text>
              </Group>

              {asset.notes && (
                <div>
                  <Text fw={500} mb="xs">Notes:</Text>
                  <Text size="sm" c="orange" style={{ fontStyle: 'italic' }}>
                    {asset.notes}
                  </Text>
                </div>
              )}

              <Form method="post">
                <input type="hidden" name="intent" value="inspect" />
                <Button
                  type="submit"
                  variant="light"
                  leftSection={<IconCalendar size={16} />}
                  fullWidth
                >
                  Mark as Inspected Today
                </Button>
              </Form>
            </Stack>
          </Card>

          {/* Room Information */}
          <Card withBorder p="lg" style={{ flex: 1 }}>
            <Stack gap="md">
              <Title order={3}>Room Information</Title>

              <Group gap="xs">
                <Text fw={500}>Room Number:</Text>
                <Text>{asset.room.number}</Text>
              </Group>

              <Group gap="xs">
                <Text fw={500}>Room Type:</Text>
                <Badge variant="light">
                  {asset.room.type.displayName}
                </Badge>
              </Group>

              <Group gap="xs">
                <Text fw={500}>Block:</Text>
                <Text>{asset.room.blockRelation?.name || asset.room.block}</Text>
              </Group>

              <Group gap="xs">
                <Text fw={500}>Floor:</Text>
                <Text>{asset.room.floor}</Text>
              </Group>

              <Button
                component="a"
                href={`/dashboard/rooms/${asset.roomId}`}
                variant="light"
                fullWidth
              >
                View Room Details
              </Button>
            </Stack>
          </Card>
        </Group>

        {/* Edit Form */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Edit Asset</Title>
          
          <Form method="post">
            <input type="hidden" name="intent" value="update" />
            
            <Group gap="md">
              <TextInput
                label="Asset Name"
                name="name"
                defaultValue={asset.name}
                required
                style={{ flex: 1 }}
              />

              <Select
                label="Category"
                name="category"
                defaultValue={asset.category}
                data={[
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
                ]}
                required
                style={{ flex: 1 }}
              />
            </Group>

            <Group gap="md" mt="md">
              <Select
                label="Condition"
                name="condition"
                defaultValue={asset.condition}
                data={[
                  { value: "EXCELLENT", label: "Excellent" },
                  { value: "GOOD", label: "Good" },
                  { value: "FAIR", label: "Fair" },
                  { value: "POOR", label: "Poor" },
                  { value: "DAMAGED", label: "Damaged" },
                  { value: "BROKEN", label: "Broken" },
                  { value: "MISSING", label: "Missing" },
                ]}
                required
                style={{ flex: 1 }}
              />

              <NumberInput
                label="Quantity"
                name="quantity"
                defaultValue={asset.quantity}
                min={1}
                required
                style={{ flex: 1 }}
              />
            </Group>

            <TextInput
              label="Serial Number"
              name="serialNumber"
              defaultValue={asset.serialNumber || ""}
              mt="md"
            />

            <Textarea
              label="Description"
              name="description"
              defaultValue={asset.description || ""}
              mt="md"
            />

            <Textarea
              label="Notes"
              name="notes"
              defaultValue={asset.notes || ""}
              description="Maintenance notes or observations"
              mt="md"
            />

            <Group justify="flex-end" mt="lg">
              <Button
                type="button"
                variant="light"
                onClick={() => navigate("/dashboard/assets")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                leftSection={<IconDeviceFloppy size={16} />}
              >
                Save Changes
              </Button>
            </Group>
          </Form>
        </Card>

        {/* Maintenance History - Coming Soon */}
        {/*
        {asset.maintenance && asset.maintenance.length > 0 && (
          <Card withBorder p="lg">
            <Title order={3} mb="md">Maintenance History</Title>
            <Stack gap="sm">
              {asset.maintenance.map((maintenance) => (
                <Paper key={maintenance.id} withBorder p="sm">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500} size="sm">{maintenance.title}</Text>
                      <Text size="xs" c="dimmed">
                        {format(new Date(maintenance.createdAt), "MMM dd, yyyy")} by {maintenance.user.firstName} {maintenance.user.lastName}
                      </Text>
                    </div>
                    <Badge
                      color={
                        maintenance.status === "COMPLETED" ? "green" :
                        maintenance.status === "IN_PROGRESS" ? "blue" :
                        maintenance.status === "SCHEDULED" ? "yellow" : "gray"
                      }
                      size="sm"
                    >
                      {maintenance.status.replace("_", " ")}
                    </Badge>
                  </Group>
                  {maintenance.description && (
                    <Text size="sm" c="dimmed" mt="xs">
                      {maintenance.description}
                    </Text>
                  )}
                </Paper>
              ))}
            </Stack>
          </Card>
        )}
        */}
      </Stack>
    </DashboardLayout>
  );
}
