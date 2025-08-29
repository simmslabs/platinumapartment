import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigate, useNavigation } from "@remix-run/react";
import {
  Title,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  TextInput,
  Alert,
  Paper,
  Divider,
  NumberInput,
  Textarea,
  ActionIcon,
  Tooltip,
  FileInput,
  Progress,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconBuilding, IconTrash, IconEye, IconUpload, IconDownload, IconFileSpreadsheet } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { useState, useEffect } from "react";

type BlockWithStats = {
  id: string;
  name: string;
  description: string | null;
  floors: number | null;
  location: string | null;
  createdAt: string; // Serialized date from Remix
  updatedAt: string; // Serialized date from Remix
  stats: {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number;
  };
};

export const meta: MetaFunction = () => {
  return [
    { title: "Blocks - Apartment Management" },
    { name: "description", content: "Manage building blocks" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const blocks = await db.block.findMany({
    include: {
      rooms: {
        include: {
          bookings: {
            where: {
              status: {
                in: ["CONFIRMED", "CHECKED_IN"]
              }
            }
          }
        }
      }
    },
    orderBy: { name: "asc" },
  });

  // Calculate occupancy statistics for each block
  const blocksWithStats = blocks.map(block => {
    const totalRooms = block.rooms.length;
    const occupiedRooms = block.rooms.filter(room => 
      room.bookings.some(booking => 
        booking.status === "CHECKED_IN" || 
        (booking.status === "CONFIRMED" && new Date(booking.checkIn) <= new Date() && new Date(booking.checkOut) > new Date())
      )
    ).length;
    
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    return {
      ...block,
      stats: {
        totalRooms,
        occupiedRooms,
        availableRooms: totalRooms - occupiedRooms,
        occupancyRate: Math.round(occupancyRate)
      }
    };
  });

  return json({ user, blocks: blocksWithStats });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // Only allow ADMIN users to create/edit/delete blocks
  if (user.role !== "ADMIN") {
    return json({ error: "Only administrators can manage blocks" }, { status: 403 });
  }

  try {
    if (intent === "create") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const floorsStr = formData.get("floors") as string;
      const location = formData.get("location") as string;

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
      await db.block.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          floors,
          location: location?.trim() || null,
        },
      });

      return json({ success: "Block created successfully" });

    } else if (intent === "update") {
      const blockId = formData.get("blockId") as string;
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const floorsStr = formData.get("floors") as string;
      const location = formData.get("location") as string;

      if (!blockId || !name) {
        return json({ error: "Block ID and name are required" }, { status: 400 });
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

      return json({ success: "Block updated successfully" });

    } else if (intent === "delete") {
      const blockId = formData.get("blockId") as string;

      if (!blockId) {
        return json({ error: "Block ID is required" }, { status: 400 });
      }

      // Check if block has any rooms
      const blockWithRooms = await db.block.findUnique({
        where: { id: blockId },
        include: {
          rooms: true
        }
      });

      if (!blockWithRooms) {
        return json({ error: "Block not found" }, { status: 404 });
      }

      if (blockWithRooms.rooms.length > 0) {
        return json({ 
          error: `Cannot delete block "${blockWithRooms.name}" because it contains ${blockWithRooms.rooms.length} room(s). Please move or delete all rooms first.` 
        }, { status: 400 });
      }

      // Delete the block
      await db.block.delete({
        where: { id: blockId },
      });

      return json({ success: "Block deleted successfully" });
    
    } else if (intent === "import") {
      // Handle Excel/CSV import
      const file = formData.get("file") as File;
      
      if (!file || file.size === 0) {
        return json({ error: "Please select a valid Excel or CSV file" }, { status: 400 });
      }

      // Check file type
      const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv'
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        return json({ error: "Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file" }, { status: 400 });
      }

      try {
        // For this example, we'll handle CSV files. For Excel files, you'd need a library like xlsx
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          return json({ error: "File must contain at least a header row and one data row" }, { status: 400 });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Check required headers
        const requiredHeaders = ['name'];
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        
        if (missingHeaders.length > 0) {
          return json({ 
            error: `Missing required columns: ${missingHeaders.join(', ')}. Required: name. Optional: description, floors, location` 
          }, { status: 400 });
        }

        const results = {
          total: 0,
          success: 0,
          errors: [] as string[],
          imported: [] as Array<{ name: string; description?: string; floors?: number; location?: string }>
        };

        // Process each data row
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          results.total++;

          try {
            const blockData: {
              name?: string;
              description?: string | null;
              floors?: number | null;
              location?: string | null;
            } = {};
            
            headers.forEach((header, index) => {
              const value = values[index] || '';
              switch (header) {
                case 'name':
                  blockData.name = value;
                  break;
                case 'description':
                  blockData.description = value || null;
                  break;
                case 'floors':
                  blockData.floors = value ? parseInt(value) : null;
                  break;
                case 'location':
                  blockData.location = value || null;
                  break;
              }
            });

            // Validate required fields
            if (!blockData.name) {
              results.errors.push(`Row ${i + 1}: Block name is required`);
              continue;
            }

            // Check if block already exists
            const existingBlock = await db.block.findFirst({
              where: { name: blockData.name }
            });

            if (existingBlock) {
              results.errors.push(`Row ${i + 1}: Block "${blockData.name}" already exists`);
              continue;
            }

            // Create the block
            await db.block.create({
              data: {
                name: blockData.name,
                description: blockData.description || undefined,
                floors: blockData.floors || undefined,
                location: blockData.location || undefined,
              }
            });

            results.success++;
            results.imported.push({
              name: blockData.name,
              description: blockData.description || undefined,
              floors: blockData.floors || undefined,
              location: blockData.location || undefined,
            });

          } catch (error) {
            console.error(`Error processing row ${i + 1}:`, error);
            results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return json({ 
          success: `Import completed! ${results.success} blocks imported successfully.`,
          importResults: results
        });

      } catch (error) {
        console.error("Import error:", error);
        return json({ error: "Failed to process import file" }, { status: 500 });
      }

    } else if (intent === "downloadTemplate") {
      // Generate CSV template
      const csvContent = "name,description,floors,location\nSample Block,Sample Description,4,Sample Location";
      
      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=blocks_template.csv",
        },
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Block action error:", error);
    return json({ error: "An error occurred while processing your request" }, { status: 500 });
  }
}

export default function BlocksPage() {
  const { user, blocks } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [importModalOpened, { open: openImportModal, close: closeImportModal }] = useDisclosure(false);
  
  const [editingBlock, setEditingBlock] = useState<BlockWithStats | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<BlockWithStats | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check if we're currently submitting
  const isSubmitting = navigation.state === "submitting";

  // Handle import modal close
  const handleImportModalClose = () => {
    if (!isUploading) {
      setImportFile(null);
      closeImportModal();
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importFile) return;

    setIsUploading(true);
    // Form submission will be handled by Remix action
    const form = event.currentTarget;
    form.submit();
  };

  // Close modals on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData) {
      closeCreateModal();
      closeEditModal();
      closeDeleteModal();
      setEditingBlock(null);
      setDeletingBlock(null);
    }
  }, [actionData, closeCreateModal, closeEditModal, closeDeleteModal]);

  const handleEdit = (block: BlockWithStats) => {
    setEditingBlock(block);
    openEditModal();
  };

  const handleDelete = (block: BlockWithStats) => {
    setDeletingBlock(block);
    openDeleteModal();
  };

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return "red";
    if (rate >= 70) return "orange";
    if (rate >= 50) return "yellow";
    if (rate >= 30) return "blue";
    return "green";
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>Building Blocks</Title>
          {user.role === "ADMIN" && (
            <Group>
              <Button 
                variant="outline"
                leftSection={<IconUpload size={16} />} 
                onClick={openImportModal}
              >
                Import
              </Button>
              <Button 
                variant="outline"
                leftSection={<IconPlus size={16} />} 
                onClick={() => navigate("/dashboard/blocks/new")}
              >
                New Block
              </Button>
              <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                Quick Add
              </Button>
            </Group>
          )}
        </Group>

        {actionData && 'error' in actionData && (
          <Alert variant="light" color="red" title="Error" icon={<IconInfoCircle />}>
            {actionData.error}
          </Alert>
        )}

        {actionData && 'success' in actionData && (
          <Alert variant="light" color="green" title="Success" icon={<IconInfoCircle />}>
            {actionData.success}
          </Alert>
        )}

        {blocks.length === 0 ? (
          <Paper p="xl" radius="md" style={{ textAlign: "center" }}>
            <IconBuilding size={48} style={{ opacity: 0.5, margin: "0 auto 16px" }} />
            <Text size="lg" fw={500} mb="xs">No blocks found</Text>
            <Text c="dimmed" mb="lg">
              Start by creating your first building block to organize your rooms.
            </Text>
            {user.role === "ADMIN" && (
              <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                Create First Block
              </Button>
            )}
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {blocks.map((block) => (
              <Card key={block.id} shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Text fw={600} size="lg">{block.name}</Text>
                      {block.description && (
                        <Text size="sm" c="dimmed">{block.description}</Text>
                      )}
                    </Stack>
                    <Group gap="xs">
                      <Tooltip label="View Details">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => navigate(`/dashboard/blocks/${block.id}`)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {user.role === "ADMIN" && (
                        <>
                          <Tooltip label="Edit Block">
                            <ActionIcon
                              variant="light"
                              color="orange"
                              onClick={() => handleEdit(block)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete Block">
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleDelete(block)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Total Rooms</Text>
                      <Text fw={600}>{block.stats.totalRooms}</Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Occupied</Text>
                      <Text fw={600}>{block.stats.occupiedRooms}</Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Available</Text>
                      <Text fw={600}>{block.stats.availableRooms}</Text>
                    </Stack>
                  </Group>

                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Occupancy Rate</Text>
                      <Badge color={getOccupancyColor(block.stats.occupancyRate)} size="sm">
                        {block.stats.occupancyRate}%
                      </Badge>
                    </Group>
                  </Stack>

                  {(block.floors || block.location) && (
                    <>
                      <Divider />
                      <Stack gap={4}>
                        {block.floors && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Floors</Text>
                            <Text size="sm">{block.floors}</Text>
                          </Group>
                        )}
                        {block.location && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Location</Text>
                            <Text size="sm">{block.location}</Text>
                          </Group>
                        )}
                      </Stack>
                    </>
                  )}
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Create Block Modal */}
        <Modal
          opened={createModalOpened}
          onClose={closeCreateModal}
          title="Create New Block"
          size="md"
        >
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Stack gap="md">
              <TextInput
                label="Block Name"
                name="name"
                placeholder="A, B, East Wing, etc."
                required
                disabled={isSubmitting}
              />

              <Textarea
                label="Description"
                name="description"
                placeholder="Optional description of the block"
                disabled={isSubmitting}
                rows={3}
              />

              <NumberInput
                label="Number of Floors"
                name="floors"
                placeholder="Optional"
                min={1}
                disabled={isSubmitting}
              />

              <TextInput
                label="Location"
                name="location"
                placeholder="Physical location or address details"
                disabled={isSubmitting}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={closeCreateModal} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  leftSection={!isSubmitting ? <IconPlus size={16} /> : undefined}
                >
                  {isSubmitting ? "Creating..." : "Create Block"}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>

        {/* Edit Block Modal */}
        <Modal
          opened={editModalOpened}
          onClose={closeEditModal}
          title="Edit Block"
          size="md"
        >
          {editingBlock && (
            <Form method="post">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="blockId" value={editingBlock.id} />
              <Stack gap="md">
                <TextInput
                  label="Block Name"
                  name="name"
                  defaultValue={editingBlock.name}
                  placeholder="A, B, East Wing, etc."
                  required
                  disabled={isSubmitting}
                />

                <Textarea
                  label="Description"
                  name="description"
                  defaultValue={editingBlock.description || ""}
                  placeholder="Optional description of the block"
                  disabled={isSubmitting}
                  rows={3}
                />

                <NumberInput
                  label="Number of Floors"
                  name="floors"
                  defaultValue={editingBlock.floors || undefined}
                  placeholder="Optional"
                  min={1}
                  disabled={isSubmitting}
                />

                <TextInput
                  label="Location"
                  name="location"
                  defaultValue={editingBlock.location || ""}
                  placeholder="Physical location or address details"
                  disabled={isSubmitting}
                />

                <Group justify="flex-end">
                  <Button variant="outline" onClick={closeEditModal} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    leftSection={!isSubmitting ? <IconEdit size={16} /> : undefined}
                  >
                    {isSubmitting ? "Updating..." : "Update Block"}
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>

        {/* Delete Block Modal */}
        <Modal
          opened={deleteModalOpened}
          onClose={closeDeleteModal}
          title="Delete Block"
          size="md"
        >
          {deletingBlock && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="blockId" value={deletingBlock.id} />
              <Stack gap="md">
                <Alert variant="light" color="red" icon={<IconInfoCircle />}>
                  Are you sure you want to delete block &quot;<strong>{deletingBlock.name}</strong>&quot;?
                  {deletingBlock.stats.totalRooms > 0 && (
                    <Text mt="xs">
                      This block contains {deletingBlock.stats.totalRooms} room(s). 
                      You must move or delete all rooms before deleting the block.
                    </Text>
                  )}
                  This action cannot be undone.
                </Alert>

                <Group justify="flex-end">
                  <Button variant="outline" onClick={closeDeleteModal} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    color="red"
                    loading={isSubmitting}
                    leftSection={!isSubmitting ? <IconTrash size={16} /> : undefined}
                    disabled={deletingBlock.stats.totalRooms > 0}
                  >
                    {isSubmitting ? "Deleting..." : "Delete Block"}
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>

        {/* Import Blocks Modal */}
        <Modal
          opened={importModalOpened}
          onClose={handleImportModalClose}
          title="Import Blocks from Excel/CSV"
          size="lg"
          closeOnClickOutside={!isUploading}
          closeOnEscape={!isUploading}
        >
          <Stack>
            <Alert color="blue" icon={<IconInfoCircle size={16} />}>
              Upload an Excel (.xlsx, .xls) or CSV (.csv) file with block information.
              <Text size="sm" mt="xs">
                Required columns: name
                <br />
                Optional columns: description, floors, location
              </Text>
            </Alert>

            <Group justify="space-between">
              <Text size="sm" fw={500}>Download Template</Text>
              <Form method="post" style={{ display: 'inline' }}>
                <input type="hidden" name="intent" value="downloadTemplate" />
                <Button 
                  type="submit"
                  variant="light" 
                  size="xs"
                  leftSection={<IconDownload size={16} />}
                >
                  Download CSV Template
                </Button>
              </Form>
            </Group>

            <Form method="post" encType="multipart/form-data" onSubmit={handleFileUpload}>
              <input type="hidden" name="intent" value="import" />
              <Stack gap="md">
                <FileInput
                  name="file"
                  label="Select Excel or CSV file"
                  placeholder="Click to select file"
                  accept=".xlsx,.xls,.csv"
                  value={importFile}
                  onChange={setImportFile}
                  required
                  leftSection={<IconFileSpreadsheet size={16} />}
                />

                {isUploading && (
                  <Progress value={100} size="lg" animated striped color="blue" />
                )}

                <Group justify="flex-end">
                  <Button 
                    variant="outline" 
                    onClick={handleImportModalClose}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    loading={isUploading}
                    disabled={!importFile}
                    leftSection={<IconUpload size={16} />}
                  >
                    {isUploading ? "Importing..." : "Import Blocks"}
                  </Button>
                </Group>
              </Stack>
            </Form>
          </Stack>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
