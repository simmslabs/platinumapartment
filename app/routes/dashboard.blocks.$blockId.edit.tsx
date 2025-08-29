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
import { IconArrowLeft, IconDeviceFloppy, IconInfoCircle, IconBuilding } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const blockName = data?.block?.name || "Unknown";
  return [
    { title: `Edit Block ${blockName} - Apartment Management` },
    { name: "description", content: `Edit building block ${blockName}` },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { blockId } = params;

  // Only allow ADMIN users to edit blocks
  if (user.role !== "ADMIN") {
    throw new Response("Only administrators can edit blocks", { status: 403 });
  }

  if (!blockId) {
    throw new Response("Block ID is required", { status: 400 });
  }

  const block = await db.block.findUnique({
    where: { id: blockId },
    include: {
      rooms: {
        select: {
          id: true,
          number: true,
        },
        orderBy: { number: "asc" }
      }
    }
  });

  if (!block) {
    throw new Response("Block not found", { status: 404 });
  }

  return json({ user, block });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const { blockId } = params;

  // Only allow ADMIN users to edit blocks
  if (user.role !== "ADMIN") {
    return json({ error: "Only administrators can edit blocks" }, { status: 403 });
  }

  if (!blockId) {
    return json({ error: "Block ID is required" }, { status: 400 });
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

    // Check if another block with this name exists (excluding current block)
    const existingBlock = await db.block.findFirst({
      where: { 
        name: name.trim(),
        id: { not: blockId }
      }
    });

    if (existingBlock) {
      return json({ error: "A block with this name already exists" }, { status: 400 });
    }

    // Update the block
    await db.block.update({
      where: { id: blockId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        floors,
        location: location?.trim() || null,
      },
    });

    return redirect(`/dashboard/blocks/${blockId}`);

  } catch (error) {
    console.error("Block update error:", error);
    return json({ error: "An error occurred while updating the block" }, { status: 500 });
  }
}

export default function EditBlockPage() {
  const { user, block } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  const breadcrumbItems = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Blocks", href: "/dashboard/blocks" },
    { title: block.name, href: `/dashboard/blocks/${block.id}` },
    { title: "Edit", href: "#" },
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
                onClick={() => navigate(`/dashboard/blocks/${block.id}`)}
              >
                Back to Block Details
              </Button>
            </Group>
          </Stack>
        </Group>

        <Title order={2}>Edit Block: {block.name}</Title>

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
                defaultValue={block.name}
                placeholder="A, B, East Wing, Tower 1, etc."
                description="Unique identifier for this block"
                required
                disabled={isSubmitting}
                error={actionData && 'error' in actionData && actionData.error.includes("name") ? actionData.error : undefined}
              />

              <Textarea
                label="Description"
                name="description"
                defaultValue={block.description || ""}
                placeholder="Optional description of the block"
                description="Brief description of what this block contains or its purpose"
                disabled={isSubmitting}
                rows={3}
              />

              <Group grow>
                <NumberInput
                  label="Number of Floors"
                  name="floors"
                  defaultValue={block.floors || undefined}
                  placeholder="Optional"
                  description="Total floors in this block"
                  min={1}
                  max={200}
                  disabled={isSubmitting}
                />

                <TextInput
                  label="Location"
                  name="location"
                  defaultValue={block.location || ""}
                  placeholder="Physical location or address details"
                  description="Where this block is located"
                  disabled={isSubmitting}
                />
              </Group>

              {block.rooms.length > 0 && (
                <Alert variant="light" color="blue" icon={<IconInfoCircle />}>
                  This block contains {block.rooms.length} room(s). 
                  Room assignments will be maintained when updating block information.
                </Alert>
              )}

              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/dashboard/blocks/${block.id}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  leftSection={!isSubmitting ? <IconDeviceFloppy size={16} /> : undefined}
                >
                  {isSubmitting ? "Saving Changes..." : "Save Changes"}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Card>
      </Stack>
    </DashboardLayout>
  );
}
