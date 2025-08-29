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
  SimpleGrid,
  TextInput,
  Select,
  Container,
  Paper,
  ActionIcon,
  Tooltip,
  Progress,
  Alert,
} from "@mantine/core";
import {
  IconSearch,
  IconPlus,
  IconAlertTriangle,
  IconCalendar,
  IconTools,
  IconEye,
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

  // Get all assets with room information
  const assets = await db.roomAsset.findMany({
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
    },
    orderBy: [
      { condition: "asc" }, // Show problematic assets first
      { lastInspected: "asc" }, // Then least recently inspected
      { createdAt: "desc" },
    ],
  });

  // Get asset statistics
  const totalAssets = assets.length;
  const assetsByCondition = assets.reduce((acc, asset) => {
    acc[asset.condition] = (acc[asset.condition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const assetsByCategory = assets.reduce((acc, asset) => {
    acc[asset.category] = (acc[asset.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Assets needing attention (poor condition, damaged, broken, or missing)
  const assetsNeedingAttention = assets.filter(asset => 
    ['POOR', 'DAMAGED', 'BROKEN', 'MISSING'].includes(asset.condition)
  );

  // Assets needing inspection (no inspection date or over 6 months old)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const assetsNeedingInspection = assets.filter(asset => 
    !asset.lastInspected || asset.lastInspected < sixMonthsAgo
  );

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

  // Filter assets based on search and filters
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.room.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || asset.category === selectedCategory;
    const matchesCondition = !selectedCondition || asset.condition === selectedCondition;
    
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

          {/* Assets Grid */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {filteredAssets.map((asset) => (
              <Card key={asset.id} withBorder shadow="sm" p="md">
                <Stack gap="sm">
                  {/* Asset Header */}
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Text>{getCategoryIcon(asset.category)}</Text>
                      <Text fw={500} size="sm">{asset.name}</Text>
                    </Group>
                    <Badge
                      color={getConditionColor(asset.condition)}
                      size="sm"
                    >
                      {asset.condition}
                    </Badge>
                  </Group>

                  {/* Room Information */}
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Room:</Text>
                    <Text size="sm" fw={500}>
                      {asset.room.number} - {asset.room.type.displayName}
                    </Text>
                  </Group>
                  
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Block:</Text>
                    <Text size="sm">
                      {asset.room.blockRelation?.name || asset.room.block}
                    </Text>
                  </Group>

                  {/* Asset Details */}
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Category:</Text>
                    <Badge variant="light" size="sm">
                      {asset.category.replace('_', ' ')}
                    </Badge>
                  </Group>

                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Quantity:</Text>
                    <Text size="sm">{asset.quantity}</Text>
                  </Group>

                  {asset.serialNumber && (
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">Serial:</Text>
                      <Text size="sm" ff="monospace">{asset.serialNumber}</Text>
                    </Group>
                  )}

                  {asset.lastInspected && (
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">Last Inspected:</Text>
                      <Text size="sm">
                        {format(new Date(asset.lastInspected), "MMM dd, yyyy")}
                      </Text>
                    </Group>
                  )}

                  {asset.notes && (
                    <Text size="sm" c="orange" style={{ fontStyle: 'italic' }}>
                      {asset.notes}
                    </Text>
                  )}

                  {/* Action Buttons */}
                  <Group gap="xs" mt="md">
                    <Tooltip label="View Room">
                      <ActionIcon
                        component={Link}
                        to={`/dashboard/rooms/${asset.roomId}`}
                        variant="light"
                        size="sm"
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                    </Tooltip>
                    
                    <Tooltip label="Create Maintenance Task">
                      <ActionIcon
                        component={Link}
                        to={`/dashboard/maintenance/new?assetId=${asset.id}`}
                        variant="light"
                        color="orange"
                        size="sm"
                      >
                        <IconTools size={14} />
                      </ActionIcon>
                    </Tooltip>
                    
                    <Tooltip label="Schedule Inspection">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="sm"
                      >
                        <IconCalendar size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          {filteredAssets.length === 0 && (
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
