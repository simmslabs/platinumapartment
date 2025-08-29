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
  Select,
  Textarea,
  Alert,
  Paper,
  Breadcrumbs,
  Anchor,
  Container,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle, IconPackage } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { AssetCategory } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Add New Asset - Apartment Management" },
    { name: "description", content: "Add a new asset to any room" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  return json({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const category = formData.get("category") as AssetCategory;
  const description = formData.get("description") as string || null;
  const serialNumber = formData.get("serialNumber") as string || null;
  const purchaseDate = formData.get("purchaseDate") as string || null;
  const warrantyExpiry = formData.get("warrantyExpiry") as string || null;
  const notes = formData.get("notes") as string || null;

  // Validation
  if (!name || !category) {
    return json({
      error: "Please fill in all required fields.",
    }, { status: 400 });
  }

  try {
    const asset = await db.asset.create({
      data: {
        name,
        category,
        description,
        serialNumber,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        notes,
        lastInspected: new Date(), // Set inspection date on creation
      },
    });

    return redirect(`/dashboard/assets?created=${asset.id}`);
  } catch (error) {
    console.error("Error creating asset:", error);
    return json({
      error: "Failed to create asset. Please try again.",
    }, { status: 500 });
  }
}

export default function NewAsset() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

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

  return (
    <DashboardLayout user={user}>
      <Container size="md">
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
                <Title order={2}>Create New Asset</Title>
                <Text c="dimmed" size="sm">
                  Create a general asset that can be assigned to rooms later
                </Text>
                <Breadcrumbs>
                  <Anchor component="button" onClick={() => navigate("/dashboard/assets")}>
                    Assets
                  </Anchor>
                  <Text>Create Asset</Text>
                </Breadcrumbs>
              </div>
            </Group>
            <IconPackage size={32} color="var(--mantine-color-blue-6)" />
          </Group>

          {/* Error Message */}
          {actionData?.error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {actionData.error}
            </Alert>
          )}

          {/* Form */}
          <Paper withBorder p="lg">
            <Form method="post">
              <Stack gap="md">
                {/* Basic Asset Information */}
                <Group gap="md" grow>
                  <TextInput
                    label="Asset Name"
                    name="name"
                    placeholder="e.g., Queen Size Bed, Samsung Smart TV"
                    required
                    description="Be specific with the asset name"
                  />

                  <Select
                    label="Category"
                    name="category"
                    placeholder="Select asset category"
                    data={categoryOptions}
                    required
                    description="Choose the most appropriate category"
                  />
                </Group>

                {/* Optional Details */}
                <Textarea
                  label="Description"
                  name="description"
                  placeholder="Detailed description of the asset, brand, model, features, etc."
                  description="Add any relevant details about the asset"
                  minRows={2}
                />

                <Group gap="md" grow>
                  <TextInput
                    label="Serial Number"
                    name="serialNumber"
                    placeholder="e.g., TV-001-2024, AC-123-456"
                    description="For tracking valuable items"
                  />
                </Group>

                {/* Dates */}
                <Group gap="md" grow>
                  <TextInput
                    label="Purchase Date"
                    name="purchaseDate"
                    type="date"
                    description="When was this asset purchased"
                  />

                  <TextInput
                    label="Warranty Expiry"
                    name="warrantyExpiry"
                    type="date"
                    description="When does the warranty expire"
                  />
                </Group>

                {/* Notes */}
                <Textarea
                  label="Notes"
                  name="notes"
                  placeholder="Any maintenance notes, observations, or special instructions"
                  description="Additional notes about the asset condition or requirements"
                  minRows={2}
                />

                {/* Action Buttons */}
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
                    Create Asset
                  </Button>
                </Group>
              </Stack>
            </Form>
          </Paper>

          {/* Helper Information */}
          <Paper withBorder p="md" bg="blue.0">
            <Stack gap="xs">
              <Text fw={500} size="sm">💡 Asset Creation Tips</Text>
              <Text size="sm" c="dimmed">
                • Use descriptive names that include brand/model when relevant
              </Text>
              <Text size="sm" c="dimmed">
                • Serial numbers help track valuable electronics and equipment
              </Text>
              <Text size="sm" c="dimmed">
                • Set condition accurately - this affects maintenance scheduling
              </Text>
              <Text size="sm" c="dimmed">
                • Purchase and warranty dates help with replacement planning
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </DashboardLayout>
  );
}
