import { useState, useEffect } from "react";
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Grid,
  Progress,
  Alert,
  ActionIcon,
  Tooltip,
  Box,
  NumberFormatter,
} from "@mantine/core";
import {
  IconCloud,
  IconDatabase,
  IconPhoto,
  IconRefresh,
  IconCheck,
  IconX,
  IconExclamationMark,
} from "@tabler/icons-react";

interface StorageStats {
  r2Configured: boolean;
  totalImages: number;
  r2Images: number;
  base64Images: number;
  estimatedDatabaseSize: number;
  estimatedR2Size: number;
  recentUploads: {
    day: number;
    week: number;
    month: number;
  };
}

export function StorageMonitor() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/storage-stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }
      
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Storage Monitor</Title>
            <ActionIcon variant="subtle" loading>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
          <Text c="dimmed">Loading storage statistics...</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder>
        <Alert
          icon={<IconExclamationMark size={16} />}
          title="Error"
          color="red"
          variant="light"
        >
          {error}
          <Group mt="sm">
            <ActionIcon size="sm" onClick={fetchStats}>
              <IconRefresh size={12} />
            </ActionIcon>
          </Group>
        </Alert>
      </Card>
    );
  }

  if (!stats) return null;

  const r2Percentage = stats.totalImages > 0 ? (stats.r2Images / stats.totalImages) * 100 : 0;
  const migrationComplete = stats.base64Images === 0 && stats.r2Images > 0;

  return (
    <Card withBorder>
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={4}>Storage Monitor</Title>
          <Group gap="xs">
            <Badge
              color={stats.r2Configured ? 'green' : 'orange'}
              variant="light"
              leftSection={stats.r2Configured ? <IconCheck size={12} /> : <IconX size={12} />}
            >
              {stats.r2Configured ? 'R2 Active' : 'Base64 Only'}
            </Badge>
            <Tooltip label="Refresh statistics">
              <ActionIcon variant="subtle" onClick={fetchStats}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Grid>
          <Grid.Col span={6}>
            <Card withBorder padding="sm">
              <Group gap="xs" mb="xs">
                <IconCloud size={16} color="var(--mantine-color-blue-6)" />
                <Text size="sm" fw={500}>R2 Storage</Text>
              </Group>
              <Text size="xl" fw={700} c="blue">
                <NumberFormatter value={stats.r2Images} thousandSeparator />
              </Text>
              <Text size="xs" c="dimmed">
                Images ({r2Percentage.toFixed(1)}%)
              </Text>
              {stats.estimatedR2Size > 0 && (
                <Text size="xs" c="dimmed">
                  ~<NumberFormatter value={stats.estimatedR2Size / 1024 / 1024} decimalScale={1} /> MB
                </Text>
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder padding="sm">
              <Group gap="xs" mb="xs">
                <IconDatabase size={16} color="var(--mantine-color-orange-6)" />
                <Text size="sm" fw={500}>Database Storage</Text>
              </Group>
              <Text size="xl" fw={700} c="orange">
                <NumberFormatter value={stats.base64Images} thousandSeparator />
              </Text>
              <Text size="xs" c="dimmed">
                Base64 Images
              </Text>
              {stats.estimatedDatabaseSize > 0 && (
                <Text size="xs" c="dimmed">
                  ~<NumberFormatter value={stats.estimatedDatabaseSize / 1024 / 1024} decimalScale={1} /> MB
                </Text>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* Migration Progress */}
        {stats.r2Configured && stats.totalImages > 0 && (
          <Box>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Migration Progress</Text>
              <Text size="sm" c="dimmed">
                {stats.r2Images}/{stats.totalImages} migrated
              </Text>
            </Group>
            <Progress 
              value={r2Percentage} 
              color={migrationComplete ? 'green' : 'blue'}
              size="lg"
              radius="md"
            />
            {migrationComplete && (
              <Group gap="xs" mt="xs">
                <IconCheck size={14} color="var(--mantine-color-green-6)" />
                <Text size="xs" c="green">Migration complete!</Text>
              </Group>
            )}
          </Box>
        )}

        {/* Recent Activity */}
        <Box>
          <Title order={6} mb="xs">Recent Upload Activity</Title>
          <Grid>
            <Grid.Col span={4}>
              <Text ta="center">
                <Text size="lg" fw={700}>
                  <NumberFormatter value={stats.recentUploads.day} />
                </Text>
                <Text size="xs" c="dimmed">Today</Text>
              </Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text ta="center">
                <Text size="lg" fw={700}>
                  <NumberFormatter value={stats.recentUploads.week} />
                </Text>
                <Text size="xs" c="dimmed">This Week</Text>
              </Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text ta="center">
                <Text size="lg" fw={700}>
                  <NumberFormatter value={stats.recentUploads.month} />
                </Text>
                <Text size="xs" c="dimmed">This Month</Text>
              </Text>
            </Grid.Col>
          </Grid>
        </Box>

        {/* Recommendations */}
        {!stats.r2Configured && (
          <Alert
            icon={<IconPhoto size={16} />}
            title="Optimize Storage"
            color="blue"
            variant="light"
          >
            Consider setting up Cloudflare R2 for better performance and cost savings.
            See R2_SETUP.md for configuration instructions.
          </Alert>
        )}

        {stats.r2Configured && stats.base64Images > 0 && (
          <Alert
            icon={<IconCloud size={16} />}
            title="Migration Available"
            color="orange"
            variant="light"
          >
            {stats.base64Images} images can be migrated to R2 storage.
            See R2_MIGRATION.md for migration instructions.
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
