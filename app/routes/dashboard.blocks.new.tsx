import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate, useNavigation } from "@remix-run/react";
import {
  Title,
  Card,
  Button,
  Stack,
  Group,
  TextInput,
  Alert,
  NumberInput,
  Textarea,
  Breadcrumbs,
  Anchor,
} from "@mantine/core";
import { IconArrowLeft, IconPlus, IconInfoCircle, IconBuilding } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Create New Block - Apartment Management" },
    { name: "description", content: "Create a new building block" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  // Only allow ADMIN users to create blocks
  if (user.role !== "ADMIN") {
    throw new Response("Only administrators can create blocks", { status: 403 });
  }

  return json({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  
  // Only allow ADMIN users to create blocks
  if (user.role !== "ADMIN") {
    return json({ error: "Only administrators can create blocks" }, { status: 403 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const floorsStr = formData.get("floors") as string;
  const location = formData.get("location") as string;

  try {
    // Validate required fields
    if (!name) {
      return json({ error: "Block name is required" }, { status: 400 });
    }

    // Parse numeric values
    const floors = floorsStr ? parseInt(floorsStr) : null;

    // Validate parsed numeric values
    if (floorsStr && (isNaN(floors!) || floors! <= 0)) {
      return json({ error: "Floors must be a valid positive number" }, { status: 400 });
    }

    // Check if block name already exists
    const existingBlock = await db.block.findFirst({
      where: { name: name.trim() }
    });

    if (existingBlock) {
      return json({ error: "A block with this name already exists" }, { status: 400 });
    }

    // Create the block
    const block = await db.block.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        floors,
        location: location?.trim() || null,
      },
    });

    return redirect(`/dashboard/blocks/${block.id}`);

  } catch (error) {
    console.error("Block creation error:", error);
    return json({ error: "An error occurred while creating the block" }, { status: 500 });
  }
}

export default function NewBlockPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Blocks", href: "/dashboard/blocks" },
    { title: "New Block", href: "#" },
  ].map((item, index) => (
    <Anchor key={index} href={item.href} size="sm">
      {item.title}
    </Anchor>
  ));

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between">
          <Stack gap="xs">
            <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate("/dashboard/blocks")}
              >
                Back to Blocks
              </Button>
            </Group>
          </Stack>
        </Group>

        <Title order={2}>Create New Block</Title>

        {actionData && 'error' in actionData && (
          <Alert variant="light" color="red" title="Error" icon={<IconInfoCircle />}>
            {actionData.error}
          </Alert>
        )}

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Form method="post">
            <Stack gap="md">
              <Group align="center" gap="sm">
                <IconBuilding size={32} style={{ color: "var(--mantine-primary-color-6)" }} />
                <Title order={3}>Block Information</Title>
              </Group>

              <TextInput
                label="Block Name"
                name="name"
                placeholder="A, B, East Wing, Tower 1, etc."
                description="Unique identifier for this block"
                required
                disabled={isSubmitting}
                error={actionData && 'error' in actionData && actionData.error.includes("name") ? actionData.error : undefined}
              />

              <Textarea
                label="Description"
                name="description"
                placeholder="Optional description of the block"
                description="Brief description of what this block contains or its purpose"
                disabled={isSubmitting}
                rows={3}
              />

              <Group grow>
                <NumberInput
                  label="Number of Floors"
                  name="floors"
                  placeholder="Optional"
                  description="Total floors in this block"
                  min={1}
                  max={200}
                  disabled={isSubmitting}
                />

                <TextInput
                  label="Location"
                  name="location"
                  placeholder="Physical location or address details"
                  description="Where this block is located"
                  disabled={isSubmitting}
                />
              </Group>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard/blocks")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  leftSection={!isSubmitting ? <IconPlus size={16} /> : undefined}
                >
                  {isSubmitting ? "Creating Block..." : "Create Block"}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Card>
      </Stack>
    </DashboardLayout>
  );
}
