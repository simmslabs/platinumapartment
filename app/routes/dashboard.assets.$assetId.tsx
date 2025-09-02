import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Title,
  Text,
  Button,
  Card,
  Badge,
  Group,
  Stack,
  Container,
  ActionIcon,
  Alert,
  Divider,
  SimpleGrid,
  Table,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconEdit,
  IconAlertTriangle,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { format } from "date-fns";

export const meta: MetaFunction = () => {
  return [
    { title: "Asset Details - Apartment Management" },
    { name: "description", content: "View asset details and information" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  const assetId = params.assetId;

  if (!assetId) {
    throw new Response("Asset ID is required", { status: 400 });
  }

  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: {
      roomAssignments: {
        include: {
          room: true,
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  if (!asset) {
    throw new Response("Asset not found", { status: 404 });
  }

  return json({ user, asset });
}

export default function AssetDetails() {
  const { user, asset } = useLoaderData<typeof loader>();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ELECTRONICS": return "";
      case "FURNITURE": return "";
      case "BATHROOM": return "";
      case "KITCHEN": return "";
      case "BEDDING": return "";
      case "LIGHTING": return "";
      case "SAFETY": return "";
      case "DECORATION": return "";
      case "CLEANING": return "";
      default: return "";
    }
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="xl">
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
              <Group gap="sm">
                <Text span>{getCategoryIcon(asset.category)}</Text>
                <Title order={2}>{asset.name}</Title>
                <Badge variant="light" color="blue">
                  {asset.category}
                </Badge>
              </Group>
              <Text c="dimmed">Asset Details</Text>
            </div>
          </Group>
          <Button
            component={Link}
            to={`/dashboard/assets/${asset.id}/edit`}
            leftSection={<IconEdit size={16} />}
          >
            Edit Asset
          </Button>
        </Group>

        <SimpleGrid cols={1}>
          <Card withBorder p="md">
            <Title order={4} mb="md">Asset Information</Title>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500}>Name:</Text>
                <Text>{asset.name}</Text>
              </Group>

              <Group justify="space-between">
                <Text fw={500}>Category:</Text>
                <Text>{asset.category}</Text>
              </Group>

              {asset.description && (
                <>
                  <Divider />
                  <div>
                    <Text fw={500} mb="xs">Description:</Text>
                    <Text size="sm" c="dimmed">{asset.description}</Text>
                  </div>
                </>
              )}

              {asset.serialNumber && (
                <Group justify="space-between">
                  <Text fw={500}>Serial Number:</Text>
                  <Text>{asset.serialNumber}</Text>
                </Group>
              )}

              <Group justify="space-between">
                <Text fw={500}>Created:</Text>
                <Text>{format(new Date(asset.createdAt), "MMM dd, yyyy")}</Text>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Room Assignments Table */}
        <Card withBorder p="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Room Assignments</Title>
            {asset.roomAssignments.length > 0 && (
              <Badge variant="light">{asset.roomAssignments.length} assignment(s)</Badge>
            )}
          </Group>

          {asset.roomAssignments.length === 0 ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="yellow">
              This asset is not currently assigned to any room.
            </Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Room Number</Table.Th>
                  <Table.Th>Floor</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Condition</Table.Th>
                  <Table.Th>Assigned Date</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {asset.roomAssignments.map((assignment) => (
                  <Table.Tr key={assignment.id}>
                    <Table.Td>
                      <Text fw={500}>Room {assignment.room.number}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>Floor {assignment.room.floor}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{assignment.quantity}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" color="blue">
                        {assignment.condition || "Good"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {format(new Date(assignment.assignedAt), "MMM dd, yyyy")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {assignment.notes || "—"}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>
    </DashboardLayout>
  );
}
