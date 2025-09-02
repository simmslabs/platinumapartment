import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, Outlet, useLocation } from "@remix-run/react";
import {
  Title,
  Text,
  Button,
  Card,
  Badge,
  Group,
  Stack,
  SimpleGrid,
  TextInput,
  Select,
  Container,
  Paper,
  ActionIcon,
  Tooltip,
  Progress,
  Alert,
  Table,
  Avatar,
  Anchor,
} from "@mantine/core";
import {
  IconSearch,
  IconPlus,
  IconAlertTriangle,
  IconEdit,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { useState } from "react";
import { format } from "date-fns";

export const meta: MetaFunction = () => {
  return [
    { title: "Assets Management - Apartment Management" },
    { name: "description", content: "Manage all room assets and equipment" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Get all assets with their room assignments
  const assets = await db.asset.findMany({
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
      },
    },
    orderBy: { name: "asc" },
  });

  // Get asset statistics
  const totalAssets = assets.length;
  const assetsByCategory = assets.reduce((acc, asset) => {
    acc[asset.category] = (acc[asset.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // For condition statistics, we need to aggregate across all room assignments
  const assetsByCondition: Record<string, number> = {};
  const assetsNeedingAttention: unknown[] = [];
  const assetsNeedingInspection: unknown[] = [];

  assets.forEach(asset => {
    if (asset.roomAssignments.length === 0) {
      // Unassigned asset
      assetsByCondition['UNASSIGNED'] = (assetsByCondition['UNASSIGNED'] || 0) + 1;
    } else {
      asset.roomAssignments.forEach(assignment => {
        assetsByCondition[assignment.condition] = (assetsByCondition[assignment.condition] || 0) + 1;
        
        // Check if needs attention
        if (['POOR', 'DAMAGED', 'BROKEN'].includes(assignment.condition)) {
          assetsNeedingAttention.push({ asset, assignment });
        }
      });
    }

    // Assets needing inspection (no inspection date or over 6 months old)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (!asset.lastInspected || asset.lastInspected < sixMonthsAgo) {
      assetsNeedingInspection.push(asset);
    }
  });

  return json({
    user,
    assets,
    statistics: {
      totalAssets,
      assetsByCondition,
      assetsByCategory,
      assetsNeedingAttention: assetsNeedingAttention.length,
      assetsNeedingInspection: assetsNeedingInspection.length,
    },
  });
}

export default function AssetsManagement() {
  const { user, assets, statistics } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const location = useLocation();

  // Filter assets based on search and filters
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.roomAssignments.some(assignment => 
        assignment.room.number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesCategory = !selectedCategory || asset.category === selectedCategory;
    
    // For condition filtering, check if any room assignment has the selected condition
    const matchesCondition = !selectedCondition || 
      (selectedCondition === "UNASSIGNED" && asset.roomAssignments.length === 0) ||
      asset.roomAssignments.some(assignment => assignment.condition === selectedCondition);
    
    return matchesSearch && matchesCategory && matchesCondition;
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
    // You can expand this with more specific icons
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "ELECTRONICS": return "cyan";
      case "FURNITURE": return "brown";
      case "BATHROOM": return "blue";
      case "KITCHEN": return "orange";
      case "BEDDING": return "pink";
      case "LIGHTING": return "yellow";
      case "SAFETY": return "red";
      case "DECORATION": return "grape";
      case "CLEANING": return "green";
      default: return "gray";
    }
  };

  if(location.pathname !== "/dashboard/assets") return <Outlet />

  return (
    <DashboardLayout user={user}>
      <Container size="xl">
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Title order={2}>Assets Management</Title>
              <Text c="dimmed">Manage and track all room assets and equipment</Text>
            </div>
            <Group gap="sm">
              <Button
                component={Link}
                to="/dashboard/assets/new"
                leftSection={<IconPlus size={16} />}
              >
                Add Asset
              </Button>
              <Button
                component={Link}
                to="/dashboard/assets/bulk"
                variant="light"
                leftSection={<IconPlus size={16} />}
              >
                Bulk Add
              </Button>
            </Group>
          </Group>

          {/* Statistics Overview */}
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder p="lg">
              <Text size="sm" c="dimmed" mb="xs">Total Assets</Text>
              <Text size="xl" fw="bold">{statistics.totalAssets}</Text>
            </Card>
            
            <Card withBorder p="lg">
              <Text size="sm" c="dimmed" mb="xs">Need Attention</Text>
              <Text size="xl" fw="bold" c="red">{statistics.assetsNeedingAttention}</Text>
              <Text size="xs" c="dimmed">Poor/Damaged/Broken</Text>
            </Card>
            
            <Card withBorder p="lg">
              <Text size="sm" c="dimmed" mb="xs">Need Inspection</Text>
              <Text size="xl" fw="bold" c="orange">{statistics.assetsNeedingInspection}</Text>
              <Text size="xs" c="dimmed">Over 6 months</Text>
            </Card>
            
            <Card withBorder p="lg">
              <Text size="sm" c="dimmed" mb="xs">Asset Health</Text>
              <Progress
                value={
                  statistics.totalAssets > 0
                    ? ((statistics.assetsByCondition.EXCELLENT || 0) + (statistics.assetsByCondition.GOOD || 0)) / statistics.totalAssets * 100
                    : 0
                }
                color="green"
                size="sm"
              />
              <Text size="xs" c="dimmed">Good/Excellent condition</Text>
            </Card>
          </SimpleGrid>

          {/* Alerts */}
          {statistics.assetsNeedingAttention > 0 && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red">
              <Text fw={500}>Assets Requiring Immediate Attention</Text>
              <Text size="sm">
                {statistics.assetsNeedingAttention} assets are in poor, damaged, broken, or missing condition and need immediate attention.
              </Text>
            </Alert>
          )}

          {/* Filters */}
          <Paper withBorder p="md">
            <Group gap="md">
              <TextInput
                placeholder="Search assets, rooms, or descriptions..."
                leftSection={<IconSearch size={16} />}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              
              <Select
                placeholder="Filter by category"
                data={[
                  { value: "", label: "All Categories" },
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
                value={selectedCategory}
                onChange={setSelectedCategory}
                clearable
              />
              
              <Select
                placeholder="Filter by condition"
                data={[
                  { value: "", label: "All Conditions" },
                  { value: "UNASSIGNED", label: "Unassigned" },
                  { value: "EXCELLENT", label: "Excellent" },
                  { value: "GOOD", label: "Good" },
                  { value: "FAIR", label: "Fair" },
                  { value: "POOR", label: "Poor" },
                  { value: "DAMAGED", label: "Damaged" },
                  { value: "BROKEN", label: "Broken" },
                  { value: "MISSING", label: "Missing" },
                ]}
                value={selectedCondition}
                onChange={setSelectedCondition}
                clearable
              />
            </Group>
          </Paper>

          {/* Assets Table */}
          {filteredAssets.length > 0 ? (
            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Asset</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Room Assignments</Table.Th>
                    <Table.Th>Serial Number</Table.Th>
                    <Table.Th>Last Inspected</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredAssets.map((asset) => (
                    <Table.Tr key={asset.id}>
                      {/* Asset Name & Description */}
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar size="sm" radius="sm">
                            {getCategoryIcon(asset.category)}
                          </Avatar>
                          <div>
                            <Anchor
                              component={Link}
                              to={`/dashboard/assets/${asset.id}`}
                              fw={500}
                              size="sm"
                              c="dark"
                            >
                              {asset.name}
                            </Anchor>
                            {asset.description && (
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {asset.description}
                              </Text>
                            )}
                            {asset.notes && (
                              <Text size="xs" c="orange" fs="italic" lineClamp={1}>
                                {asset.notes}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>

                      {/* Category */}
                      <Table.Td>
                        <Badge color={getCategoryColor(asset.category)} size="sm">
                          {asset.category}
                        </Badge>
                      </Table.Td>

                      {/* Room Assignments */}
                      <Table.Td>
                        {asset.roomAssignments.length === 0 ? (
                          <Badge color="gray" variant="light" size="sm">
                            Unassigned
                          </Badge>
                        ) : (
                          <Stack gap="xs">
                            {asset.roomAssignments.slice(0, 2).map((assignment) => (
                              <Group key={assignment.id} gap="xs" wrap="nowrap">
                                <Anchor
                                  component={Link}
                                  to={`/dashboard/rooms/${assignment.room.id}`}
                                  size="sm"
                                  fw={500}
                                >
                                  Room {assignment.room.number}
                                </Anchor>
                                <Badge
                                  color={getConditionColor(assignment.condition)}
                                  size="xs"
                                >
                                  {assignment.condition}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                  Qty: {assignment.quantity}
                                </Text>
                              </Group>
                            ))}
                            {asset.roomAssignments.length > 2 && (
                              <Text size="xs" c="dimmed">
                                +{asset.roomAssignments.length - 2} more rooms
                              </Text>
                            )}
                          </Stack>
                        )}
                      </Table.Td>

                      {/* Serial Number */}
                      <Table.Td>
                        {asset.serialNumber ? (
                          <Text size="sm" ff="monospace">
                            {asset.serialNumber}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">—</Text>
                        )}
                      </Table.Td>

                      {/* Last Inspected */}
                      <Table.Td>
                        {asset.lastInspected ? (
                          <Text size="sm">
                            {format(new Date(asset.lastInspected), "MMM dd, yyyy")}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">Never</Text>
                        )}
                      </Table.Td>

                      {/* Actions */}
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Tooltip label="Edit Asset">
                            <ActionIcon
                              component={Link}
                              to={`/dashboard/assets/${asset.id}/edit`}
                              variant="light"
                              color="gray"
                              size="sm"
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          ) : (
            <Paper withBorder p="xl" ta="center">
              <Text c="dimmed" size="lg">No assets found</Text>
              <Text c="dimmed" size="sm">
                {searchTerm || selectedCategory || selectedCondition
                  ? "Try adjusting your search criteria"
                  : "Start by adding assets to rooms"
                }
              </Text>
            </Paper>
          )}
        </Stack>
      </Container>
    </DashboardLayout>
  );
}
