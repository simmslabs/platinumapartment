import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Link, Outlet, useLocation, useFetcher } from "@remix-run/react";
import {
  Title,
  Table,
  Badge,
  Stack,
  Text,
  Card,
  Group,
  Button,
  Modal,
  TextInput,
  Alert,
  ActionIcon,
  Select,
  Grid,
  Paper,
  ThemeIcon,
  NumberFormatter,
  FileInput,
  List,
  Avatar,
  Checkbox,
  Progress,
  Loader,
  Pagination,
} from "@mantine/core";
import { format } from "date-fns";
import { useDisclosure, useDebouncedValue } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconTrash, IconSearch, IconEye, IconUsers, IconWallet, IconTrendingUp, IconClock, IconUpload, IconDownload, IconFileSpreadsheet, IconTrashX } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import bcrypt from "bcryptjs";
import { useState, useEffect } from "react";
import { emailService } from "~/utils/email.server";

// Type for action responses
type ActionResponse = {
  success?: string;
  error?: string;
};

export const meta: MetaFunction = () => {
  return [
    { title: "Tenants - Apartment Management" },
    { name: "description", content: "Manage apartment guests" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Parse URL parameters for pagination and search
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "all";

  // Ensure valid pagination parameters
  const validLimit = Math.min(Math.max(limit, 10), 500); // Between 10 and 500
  const validPage = Math.max(page, 1);

  // Calculate offset for pagination
  const offset = (validPage - 1) * validLimit;

  // Build where condition for search and filtering
  const whereCondition: { 
    role: "TENANT"; 
    OR?: Array<{
      firstName?: { contains: string; mode: "insensitive" };
      lastName?: { contains: string; mode: "insensitive" };
      email?: { contains: string; mode: "insensitive" };
      phone?: { contains: string; mode: "insensitive" };
    }>
  } = { role: "TENANT" };
  
  if (search) {
    whereCondition.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get total count for pagination
  const totalGuests = await db.user.count({
    where: whereCondition,
  });

  // Get paginated guests with optimized query
  const guests = await db.user.findMany({
    where: whereCondition,
    include: {
      bookings: {
        include: {
          payment: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3, // Show only last 3 bookings
      },
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" }, // Secondary sort for consistent pagination
    ],
    take: validLimit,
    skip: offset,
  });

  // Filter by status if specified (this is done in memory for now, could be optimized)
  let filteredGuests = guests;
  if (status !== "all") {
    filteredGuests = guests.filter(guest => {
      const hasActiveBookings = guest.bookings.some((booking: { status: string }) => 
        ["CONFIRMED", "CHECKED_IN"].includes(booking.status)
      );
      return status === "active" ? hasActiveBookings : !hasActiveBookings;
    });
  }

  // Calculate overall statistics (optimized - use separate queries)
  const totalRevenue = await db.booking.aggregate({
    _sum: { totalAmount: true },
    where: { user: { role: "TENANT" } },
  });

  const totalPaid = await db.payment.aggregate({
    _sum: { amount: true },
    where: { 
      status: "COMPLETED",
      booking: { user: { role: "TENANT" } }
    },
  });

  const totalPending = await db.payment.aggregate({
    _sum: { amount: true },
    where: { 
      status: "PENDING",
      booking: { user: { role: "TENANT" } }
    },
  });

  const activeGuestsCount = await db.user.count({
    where: {
      role: "TENANT",
      bookings: {
        some: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] }
        }
      }
    },
  });

  const totalPages = Math.ceil(totalGuests / validLimit);

  return json({ 
    user, 
    guests: filteredGuests,
    pagination: {
      currentPage: validPage,
      totalPages,
      totalItems: totalGuests,
      itemsPerPage: validLimit,
      hasNextPage: validPage < totalPages,
      hasPreviousPage: validPage > 1,
    },
    searchParams: {
      search,
      status,
    },
    stats: {
      totalGuests,
      activeGuests: activeGuestsCount,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalPaid: totalPaid._sum.amount || 0,
      totalPending: totalPending._sum.amount || 0,
    }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const email = formData.get("email") as string;
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const phone = formData.get("phone") as string;
      const address = formData.get("address") as string;

      if (!firstName || !lastName) {
        return json({ error: "First name and last name are required" }, { status: 400 });
      }

      // Check if email already exists (only if email is provided)
      if (email) {
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
          return json({ error: "A user with this email already exists" }, { status: 400 });
        }
      }

      // Generate a random temporary password
      const generatePassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };

      const temporaryPassword = generatePassword();

      // Hash the password
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      // Create the user
      await db.user.create({
        data: {
          email: email || null, // Make email optional
          password: hashedPassword,
          firstName,
          lastName,
          phone: phone || null,
          address: address || null,
          role: "TENANT",
        },
      });

      // Send welcome email only if email is provided (don't block the response if email fails)
      if (email) {
        try {
          await emailService.sendWelcomeEmail({
            firstName,
            lastName,
            email,
            temporaryPassword: temporaryPassword, // Send the generated password in the email
          });
          console.log(`Welcome email sent to ${email}`);
        } catch (emailError) {
          console.error(`Failed to send welcome email to ${email}:`, emailError);
          // Don't fail the user creation if email fails
        }
      }

      return json({ 
        success: email 
          ? "Tenant created successfully with auto-generated password sent via email!" 
          : "Tenant created successfully with auto-generated password!"
      });
    }

    if (intent === "update") {
      const guestId = formData.get("guestId") as string;
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const phone = formData.get("phone") as string;
      const address = formData.get("address") as string;

      if (!firstName || !lastName) {
        return json({ error: "First name and last name are required" }, { status: 400 });
      }

      await db.user.update({
        where: { id: guestId },
        data: {
          firstName,
          lastName,
          phone: phone || null,
          address: address || null,
        },
      });

      return json({ success: "Tenant updated successfully" });
    }

    if (intent === "delete") {
      const guestId = formData.get("guestId") as string;

      try {
        // Force delete guest with proper cascade deletion
        // Use transaction to ensure all related data is deleted in correct order
        await db.$transaction(async (tx) => {
          // First, delete all payments related to this guest's bookings
          await tx.payment.deleteMany({
            where: {
              booking: {
                userId: guestId
              }
            }
          });

          // Delete all transactions related to this guest's bookings
          await tx.transaction.deleteMany({
            where: {
              booking: {
                userId: guestId
              }
            }
          });

          // Delete all receipts related to this guest's bookings
          await tx.receipt.deleteMany({
            where: {
              booking: {
                userId: guestId
              }
            }
          });

          // Delete all security deposits related to this guest's bookings
          await tx.securityDeposit.deleteMany({
            where: {
              booking: {
                userId: guestId
              }
            }
          });

          // Delete all bookings for this guest
          await tx.booking.deleteMany({
            where: {
              userId: guestId
            }
          });

          // Finally, delete the guest
          await tx.user.delete({
            where: { id: guestId }
          });
        }, {
          timeout: 30000, // 30 seconds timeout
        });

        return json({ success: "Tenant and all related data deleted successfully" });
      } catch (deleteError) {
        console.error("Error deleting guest:", deleteError);
        return json({ error: "Failed to delete guest. Please try again or contact support." }, { status: 500 });
      }
    }

    if (intent === "bulkDelete") {
      const guestIds = formData.get("guestIds") as string;
      
      if (!guestIds) {
        return json({ error: "No guests selected for deletion" }, { status: 400 });
      }

      const guestIdArray = guestIds.split(',').filter(id => id.trim() !== '');
      
      if (guestIdArray.length === 0) {
        return json({ error: "No valid guests selected for deletion" }, { status: 400 });
      }

      try {
        // Use transaction to ensure all related data is deleted in correct order
        // Use batch operations for better performance
        await db.$transaction(async (tx) => {
          // Delete all payments related to these guests' bookings in one operation
          await tx.payment.deleteMany({
            where: {
              booking: {
                userId: { in: guestIdArray }
              }
            }
          });

          // Delete all transactions related to these guests' bookings in one operation
          await tx.transaction.deleteMany({
            where: {
              booking: {
                userId: { in: guestIdArray }
              }
            }
          });

          // Delete all receipts related to these guests' bookings in one operation
          await tx.receipt.deleteMany({
            where: {
              booking: {
                userId: { in: guestIdArray }
              }
            }
          });

          // Delete all security deposits related to these guests' bookings in one operation
          await tx.securityDeposit.deleteMany({
            where: {
              booking: {
                userId: { in: guestIdArray }
              }
            }
          });

          // Delete all bookings for these guests in one operation
          await tx.booking.deleteMany({
            where: {
              userId: { in: guestIdArray }
            }
          });

          // Finally, delete all the guests in one operation
          await tx.user.deleteMany({
            where: { 
              id: { in: guestIdArray },
              role: "TENANT" // Safety check to only delete tenants
            }
          });
        }, {
          timeout: 30000, // 30 seconds timeout
        });

        return json({ 
          success: `Successfully deleted ${guestIdArray.length} tenant${guestIdArray.length > 1 ? 's' : ''} and all related data` 
        });
      } catch (deleteError) {
        console.error("Error bulk deleting guests:", deleteError);
        return json({ error: "Failed to delete selected guests. Please try again or contact support." }, { status: 500 });
      }
    }

    if (intent === "import") {
      // This will be handled by the new chunked upload system
      return json({ error: "Please use the new chunked upload system" }, { status: 400 });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Tenant action error:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return json({ error: "Email already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Tenants() {
  const { user, guests, stats, pagination, searchParams } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [bulkDeleteModalOpened, { open: openBulkDeleteModal, close: closeBulkDeleteModal }] = useDisclosure(false);
  const [guestToDelete, setGuestToDelete] = useState<typeof guests[0] | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [confirmationText, setConfirmationText] = useState("");
  const [bulkConfirmationText, setBulkConfirmationText] = useState("");
  const [searchQuery, setSearchQuery] = useState(searchParams.search || "");
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500);
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.status || "all");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    success: number;
    errors: string[];
    imported: Array<{ firstName: string; lastName: string; email: string }>;
  } | null>(null);

  // Use guests directly from loader (already filtered and paginated)
  const filteredGuests = guests;

  // Handle debounced search
  useEffect(() => {
    if (debouncedSearchQuery !== searchParams.search) {
      updateSearchParams({ search: debouncedSearchQuery });
    }
  }, [debouncedSearchQuery, searchParams.search]);

  // Handle delete fetcher responses
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data) {
      const data = deleteFetcher.data as ActionResponse;
      if (data?.success) {
        // Show success notification and refresh
        console.log(data.success);
        window.location.reload();
      } else if (data?.error) {
        // Show error notification
        console.error(data.error);
        alert(data.error);
      }
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  // Handle bulk delete fetcher responses
  useEffect(() => {
    if (bulkDeleteFetcher.state === "idle" && bulkDeleteFetcher.data) {
      const data = bulkDeleteFetcher.data as ActionResponse;
      if (data?.success) {
        // Show success notification and refresh
        console.log(data.success);
        window.location.reload();
      } else if (data?.error) {
        // Show error notification
        console.error(data.error);
        alert(data.error);
      }
    }
  }, [bulkDeleteFetcher.state, bulkDeleteFetcher.data]);

  // Helper function to update URL with search params
  const updateSearchParams = (newParams: { search?: string; status?: string; page?: number; limit?: number }) => {
    const url = new URL(window.location.href);
    
    if (newParams.search !== undefined) {
      if (newParams.search) {
        url.searchParams.set('search', newParams.search);
      } else {
        url.searchParams.delete('search');
      }
    }
    
    if (newParams.status !== undefined) {
      if (newParams.status && newParams.status !== 'all') {
        url.searchParams.set('status', newParams.status);
      } else {
        url.searchParams.delete('status');
      }
    }
    
    if (newParams.page !== undefined) {
      if (newParams.page > 1) {
        url.searchParams.set('page', newParams.page.toString());
      } else {
        url.searchParams.delete('page');
      }
    }

    if (newParams.limit !== undefined) {
      if (newParams.limit !== 20) { // 20 is default
        url.searchParams.set('limit', newParams.limit.toString());
      } else {
        url.searchParams.delete('limit');
      }
    }
    
    // Reset to page 1 when search, filter, or limit changes
    if (newParams.search !== undefined || newParams.status !== undefined || newParams.limit !== undefined) {
      url.searchParams.delete('page');
    }
    
    window.location.href = url.toString();
  };

  // Handle search change with debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Handle filter change
  const handleFilterChange = (value: string | null) => {
    const newStatus = value || "all";
    setFilterStatus(newStatus);
    updateSearchParams({ status: newStatus });
  };

  // Handle pagination change
  const handlePageChange = (page: number) => {
    updateSearchParams({ page });
  };

  // Handle page size change
  const handlePageSizeChange = (value: string | null) => {
    const newLimit = parseInt(value || "20");
    updateSearchParams({ limit: newLimit });
  };

  const handleDeleteGuest = (guest: typeof guests[0]) => {
    setGuestToDelete(guest);
    setConfirmationText("");
    openDeleteModal();
  };

  const handleSelectGuest = (guestId: string, checked: boolean) => {
    const newSelected = new Set(selectedGuests);
    if (checked) {
      newSelected.add(guestId);
    } else {
      newSelected.delete(guestId);
    }
    setSelectedGuests(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredGuests.map(guest => guest.id));
      setSelectedGuests(allIds);
    } else {
      setSelectedGuests(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedGuests.size === 0) return;
    setBulkConfirmationText("");
    openBulkDeleteModal();
  };

  const confirmBulkDelete = () => {
    if (selectedGuests.size > 0 && bulkConfirmationText === "BULK DELETE") {
      bulkDeleteFetcher.submit(
        {
          intent: "bulkDelete",
          guestIds: Array.from(selectedGuests).join(','),
        },
        {
          method: "post",
        }
      );
      
      closeBulkDeleteModal();
      setSelectedGuests(new Set());
      setBulkConfirmationText("");
    }
  };

  const handleChunkedUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadResults(null);

    try {
      // Simulate reading Excel file in chunks for upload progress
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      let uploadedChunks = 0;

      // Simulate chunked upload progress
      for (let start = 0; start < file.size; start += chunkSize) {
        uploadedChunks++;
        setUploadProgress((uploadedChunks / totalChunks) * 100);
        
        // Simulate upload delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Now process the file
      setUploadStatus('processing');
      setUploadProgress(100);
      
      // Send to chunked processing API
      const formData = new FormData();
      formData.append("intent", "import");
      formData.append("file", file);

      const response = await fetch('/api/guests/import-chunked', {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadStatus('complete');
        setUploadResults(result.results);
      } else {
        setUploadStatus('error');
        console.error("Import error:", result.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadResults(null);
    setImportFile(null);
  };

  const handleModalClose = () => {
    if (!isUploading) {
      resetUpload();
      closeImport();
    }
  };

  const confirmDelete = () => {
    if (guestToDelete && confirmationText === "FORCE DELETE") {
      deleteFetcher.submit(
        {
          intent: "delete",
          guestId: guestToDelete.id,
        },
        {
          method: "post",
        }
      );
      
      closeDeleteModal();
      setGuestToDelete(null);
      setConfirmationText("");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/guests/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'intent=download-template',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'guest-import-template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download template');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "green";
      case "PENDING":
        return "yellow";
      case "CHECKED_IN":
        return "blue";
      case "CHECKED_OUT":
        return "gray";
      case "CANCELLED":
        return "red";
      default:
        return "gray";
    }
  };

  if(location.pathname !== "/dashboard/guests") return <Outlet />

  return (
    <DashboardLayout user={user}>
        <Stack>
          <Group justify="space-between">
            <Title order={2}>Tenants Management</Title>
            {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
              <Group>
                {selectedGuests.size > 0 && (
                  <Button 
                    leftSection={<IconTrashX size={16} />} 
                    onClick={handleBulkDelete}
                    color="red"
                    variant="outline"
                  >
                    Delete {selectedGuests.size} Selected
                  </Button>
                )}
                <Button 
                  leftSection={<IconUpload size={16} />} 
                  onClick={openImport}
                  variant="outline"
                >
                  Import Tenants
                </Button>
                <Button 
                  component={Link}
                  to="/dashboard/guests/new"
                  leftSection={<IconPlus size={16} />}
                >
                  Add Tenant
                </Button>
              </Group>
            )}
          </Group>

          {actionData && "error" in actionData && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Error"
              color="red"
            >
              {actionData.error}
            </Alert>
          )}

          {actionData && "success" in actionData && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Success"
              color="green"
            >
              {actionData.success}
            </Alert>
          )}

          {/* Statistics Overview */}
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Paper p="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="sm">Total Tenants</Text>
                    <Text fw={700} size="xl">{stats.totalGuests}</Text>
                    <Text c="dimmed" size="xs">{stats.activeGuests} active</Text>
                  </div>
                  <ThemeIcon color="blue" variant="light" size="xl">
                    <IconUsers size={24} />
                  </ThemeIcon>
                </Group>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Paper p="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="sm">Total Revenue</Text>
                    <Text fw={700} size="xl">
                      <NumberFormatter value={stats.totalRevenue} prefix="₵" thousandSeparator />
                    </Text>
                    <Text c="dimmed" size="xs">from all guests</Text>
                  </div>
                  <ThemeIcon color="green" variant="light" size="xl">
                    <IconTrendingUp size={24} />
                  </ThemeIcon>
                </Group>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Paper p="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="sm">Payments Received</Text>
                    <Text fw={700} size="xl" c="green">
                      <NumberFormatter value={stats.totalPaid} prefix="₵" thousandSeparator />
                    </Text>
                    <Text c="dimmed" size="xs">completed payments</Text>
                  </div>
                  <ThemeIcon color="teal" variant="light" size="xl">
                    <IconWallet size={24} />
                  </ThemeIcon>
                </Group>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Paper p="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="sm">Pending Payments</Text>
                    <Text fw={700} size="xl" c={stats.totalPending > 0 ? "red" : "green"}>
                      <NumberFormatter value={stats.totalPending} prefix="₵" thousandSeparator />
                    </Text>
                    <Text c="dimmed" size="xs">awaiting payment</Text>
                  </div>
                  <ThemeIcon color={stats.totalPending > 0 ? "red" : "green"} variant="light" size="xl">
                    <IconClock size={24} />
                  </ThemeIcon>
                </Group>
              </Paper>
            </Grid.Col>
          </Grid>

          {/* Search and Filter Controls */}
          <Card>
            <Group>
              <TextInput
                placeholder="Search guests..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.currentTarget.value)}
                style={{ flexGrow: 1 }}
              />
              <Select
                placeholder="Filter by status"
                value={filterStatus}
                onChange={handleFilterChange}
                data={[
                  { value: "all", label: "All Tenants" },
                  { value: "active", label: "Active Tenants" },
                  { value: "inactive", label: "Inactive Tenants" },
                ]}
                style={{ minWidth: 150 }}
              />
            </Group>
          </Card>

          <Card>
            <Group justify="space-between" mb="md">
              <Text size="sm" c="dimmed">
                Showing {filteredGuests.length} of {pagination.totalItems} guests 
                (Page {pagination.currentPage} of {pagination.totalPages})
              </Text>
              <Group gap="xs">
                <Text size="sm" c="dimmed">Show:</Text>
                <Select
                  size="sm"
                  value={pagination.itemsPerPage.toString()}
                  onChange={handlePageSizeChange}
                  data={[
                    { value: "10", label: "10" },
                    { value: "20", label: "20" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                    { value: "200", label: "200" },
                    { value: "500", label: "500" },
                  ]}
                  style={{ width: 80 }}
                />
                <Text size="sm" c="dimmed">per page</Text>
              </Group>
            </Group>
            <Table.ScrollContainer minWidth={800}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                      <Table.Th>
                        <Checkbox
                          checked={filteredGuests.length > 0 && selectedGuests.size === filteredGuests.length}
                          indeterminate={selectedGuests.size > 0 && selectedGuests.size < filteredGuests.length}
                          onChange={(event) => handleSelectAll(event.currentTarget.checked)}
                        />
                      </Table.Th>
                    )}
                    <Table.Th>Tenant Information</Table.Th>
                    <Table.Th>Contact</Table.Th>
                    <Table.Th>Total Bookings</Table.Th>
                    <Table.Th>Latest Booking</Table.Th>
                    <Table.Th>Joined</Table.Th>
                  {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                    <Table.Th>Actions</Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredGuests.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={(user?.role === "ADMIN" || user?.role === "MANAGER") ? 7 : 5} style={{ textAlign: "center", padding: "2rem" }}>
                      <Stack align="center" gap="sm">
                        <IconInfoCircle size={48} color="gray" />
                        <Text c="dimmed">
                          {searchQuery || filterStatus !== "all" 
                            ? "No guests found matching your criteria" 
                            : "No guests available"}
                        </Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredGuests.map((guest) => (
                  <Table.Tr key={guest.id}>
                    {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                      <Table.Td>
                        <Checkbox
                          checked={selectedGuests.has(guest.id)}
                          onChange={(event) => handleSelectGuest(guest.id, event.currentTarget.checked)}
                        />
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Group gap="sm">
                        {guest.profilePicture ? (
                          <Avatar 
                            src={guest.profilePicture} 
                            size="md" 
                            radius="sm"
                            alt={`${guest.firstName} ${guest.lastName}`}
                          />
                        ) : (
                          <Avatar size="md" radius="sm">
                            {guest.firstName.charAt(0)}{guest.lastName.charAt(0)}
                          </Avatar>
                        )}
                        <div>
                          <Text fw={500}>
                            {guest.firstName} {guest.lastName}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {guest.email}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        {guest.phone && (
                          <Text size="sm">{guest.phone}</Text>
                        )}
                        {guest.address && (
                          <Text size="sm" c="dimmed">
                            {guest.address}
                          </Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{guest.bookings.length}</Text>
                    </Table.Td>
                    <Table.Td>
                      {guest.bookings.length > 0 ? (
                        <div>
                          <Badge color={getStatusColor(guest.bookings[0].status)} size="sm">
                            {guest.bookings[0].status.replace("_", " ")}
                          </Badge>
                          <Text size="sm" c="dimmed">
                            {format(new Date(guest.bookings[0].checkIn), "MMM dd, yyyy")}
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            component={Link}
                            to={`/dashboard/guests/${guest.id}`}
                            mt={4}
                          >
                            View Details
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Text size="sm" c="dimmed">
                            No bookings
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            component={Link}
                            to={`/dashboard/guests/${guest.id}`}
                            mt={4}
                          >
                            View Details
                          </Button>
                        </div>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {format(new Date(guest.createdAt), "MMM dd, yyyy")}
                    </Table.Td>
                    {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            component={Link}
                            to={`/dashboard/guests/${guest.id}`}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            component={Link}
                            to={`/dashboard/guests/new?guestId=${guest.id}`}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteGuest(guest)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
                )}
              </Table.Tbody>
            </Table>
            </Table.ScrollContainer>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {' '}
                    {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {' '}
                    {pagination.totalItems} entries
                  </Text>
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Jump to page:</Text>
                    <Select
                      size="sm"
                      value={pagination.currentPage.toString()}
                      onChange={(value) => value && handlePageChange(parseInt(value))}
                      data={Array.from({ length: pagination.totalPages }, (_, i) => ({
                        value: (i + 1).toString(),
                        label: (i + 1).toString(),
                      }))}
                      style={{ width: 80 }}
                    />
                  </Group>
                </Group>
                <Group justify="center">
                  <Pagination
                    value={pagination.currentPage}
                    onChange={handlePageChange}
                    total={pagination.totalPages}
                    size="md"
                    withEdges
                    siblings={1}
                    boundaries={1}
                  />
                </Group>
              </Stack>
            </Card>
          )}

          {/* Bulk Delete Confirmation Modal */}
          <Modal 
            opened={bulkDeleteModalOpened} 
            onClose={closeBulkDeleteModal} 
            title="Bulk Delete Tenants" 
            size="lg"
            centered
          >
            <Stack>
              <Alert color="red" icon={<IconInfoCircle size={16} />}>
                <Text fw={500}>⚠️ DANGER: Bulk Delete Operation!</Text>
                <Text size="sm" mt="xs">
                  This will permanently delete {selectedGuests.size} tenant{selectedGuests.size > 1 ? 's' : ''} and ALL associated data including:
                </Text>
                <List size="sm" mt="xs">
                  <List.Item>All bookings (active and completed)</List.Item>
                  <List.Item>All payment records and transactions</List.Item>
                  <List.Item>All receipts and financial history</List.Item>
                  <List.Item>All security deposits</List.Item>
                  <List.Item>Tenant profiles and personal data</List.Item>
                </List>
                <Text size="sm" mt="xs" fw={500} c="red">
                  This operation uses cascade deletion to ensure data integrity. This action cannot be undone!
                </Text>
              </Alert>

              <Text fw={500} size="lg">
                Selected Tenants ({selectedGuests.size}):
              </Text>
              
              <Stack gap="xs" mah={200} style={{ overflow: 'auto' }}>
                {filteredGuests
                  .filter(guest => selectedGuests.has(guest.id))
                  .map(guest => (
                  <Card key={guest.id} withBorder p="xs">
                    <Group gap="sm">
                      {guest.profilePicture ? (
                        <Avatar 
                          src={guest.profilePicture} 
                          size="sm" 
                          radius="sm"
                          alt={`${guest.firstName} ${guest.lastName}`}
                        />
                      ) : (
                        <Avatar size="sm" radius="sm">
                          {guest.firstName.charAt(0)}{guest.lastName.charAt(0)}
                        </Avatar>
                      )}
                      <div>
                        <Text size="sm" fw={500}>
                          {guest.firstName} {guest.lastName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {guest.email}
                        </Text>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            {guest.bookings?.length || 0} booking(s)
                          </Text>
                          {guest.bookings?.some(booking => 
                            ["CONFIRMED", "CHECKED_IN"].includes(booking.status)
                          ) && (
                            <Badge color="red" size="xs">
                              Active Bookings
                            </Badge>
                          )}
                        </Group>
                      </div>
                    </Group>
                  </Card>
                ))}
              </Stack>

              <Text size="sm" c="red" fw={500}>
                To confirm bulk deletion, type: BULK DELETE
              </Text>
              
              <TextInput
                placeholder="Type 'BULK DELETE' to confirm"
                value={bulkConfirmationText}
                onChange={(event) => setBulkConfirmationText(event.currentTarget.value)}
                error={bulkConfirmationText && bulkConfirmationText !== "BULK DELETE" ? "Must type exactly 'BULK DELETE'" : null}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={closeBulkDeleteModal}>
                  Cancel
                </Button>
                <Button 
                  color="red" 
                  onClick={confirmBulkDelete}
                  disabled={bulkConfirmationText !== "BULK DELETE" || bulkDeleteFetcher.state === "submitting"}
                  loading={bulkDeleteFetcher.state === "submitting"}
                  leftSection={<IconTrashX size={16} />}
                >
                  {bulkDeleteFetcher.state === "submitting" 
                    ? "Deleting..." 
                    : `Delete ${selectedGuests.size} Tenant${selectedGuests.size > 1 ? 's' : ''}`
                  }
                </Button>
              </Group>
            </Stack>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal 
            opened={deleteModalOpened} 
            onClose={closeDeleteModal} 
            title="Force Delete Tenant" 
            size="md"
            centered
          >
            <Stack>
              <Alert color="red" icon={<IconInfoCircle size={16} />}>
                <Text fw={500}>⚠️ DANGER: Force Delete Operation!</Text>
                <Text size="sm" mt="xs">
                  This will permanently delete the guest and ALL associated data including:
                </Text>
                <List size="sm" mt="xs">
                  <List.Item>All bookings (active and completed)</List.Item>
                  <List.Item>All payment records and transactions</List.Item>
                  <List.Item>All receipts and financial history</List.Item>
                  <List.Item>All security deposits</List.Item>
                  <List.Item>Tenant profile and personal data</List.Item>
                </List>
                <Text size="sm" mt="xs" fw={500} c="red">
                  This operation uses cascade deletion to ensure data integrity. This action cannot be undone!
                </Text>
              </Alert>

              {guestToDelete && (
                <Card withBorder p="md">
                  <Group gap="sm">
                    {guestToDelete.profilePicture ? (
                      <Avatar 
                        src={guestToDelete.profilePicture} 
                        size="md" 
                        radius="sm"
                        alt={`${guestToDelete.firstName} ${guestToDelete.lastName}`}
                      />
                    ) : (
                      <Avatar size="md" radius="sm">
                        {guestToDelete.firstName.charAt(0)}{guestToDelete.lastName.charAt(0)}
                      </Avatar>
                    )}
                    <div>
                      <Text fw={500}>
                        {guestToDelete.firstName} {guestToDelete.lastName}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {guestToDelete.email}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {guestToDelete.bookings?.length || 0} booking(s)
                      </Text>
                      {guestToDelete.bookings?.some(booking => 
                        ["CONFIRMED", "CHECKED_IN"].includes(booking.status)
                      ) && (
                        <Badge color="red" size="sm" mt="xs">
                          Has Active Bookings
                        </Badge>
                      )}
                    </div>
                  </Group>
                </Card>
              )}

              <Text size="sm" c="red" fw={500}>
                To confirm force deletion, type: FORCE DELETE
              </Text>
              
              <TextInput
                placeholder="Type 'FORCE DELETE' to confirm"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.currentTarget.value)}
                error={confirmationText && confirmationText !== "FORCE DELETE" ? "Must type exactly 'FORCE DELETE'" : null}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                <Button 
                  color="red" 
                  onClick={confirmDelete}
                  disabled={confirmationText !== "FORCE DELETE" || deleteFetcher.state === "submitting"}
                  loading={deleteFetcher.state === "submitting"}
                  leftSection={<IconTrash size={16} />}
                >
                  {deleteFetcher.state === "submitting" ? "Deleting..." : "Force Delete Tenant"}
                </Button>
              </Group>
            </Stack>
          </Modal>

          {/* Import Tenants Modal */}
          <Modal 
            opened={importOpened} 
            onClose={handleModalClose}
            title="Import Tenants from Excel" 
            size="lg"
            closeOnClickOutside={!isUploading}
            closeOnEscape={!isUploading}
            trapFocus={!isUploading}
          >
            <Stack>
              <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                Upload an Excel file (.xlsx) with guest information. 
                <Text size="sm" mt="xs">
                  Required columns: firstName, lastName
                  <br />
                  Optional columns: email, phone, address
                  <br />
                  <Text size="xs" c="dimmed">Note: Passwords will be auto-generated and sent via email (if email provided)</Text>
                </Text>
              </Alert>

              <Group justify="space-between">
                <Text size="sm" fw={500}>Download Template</Text>
                <Button
                  size="compact-sm"
                  variant="outline"
                  leftSection={<IconDownload size={14} />}
                  onClick={handleDownloadTemplate}
                >
                  Download Excel Template
                </Button>
              </Group>

              <Stack>
                <FileInput
                  label="Select Excel File"
                  placeholder="Choose .xlsx file"
                  accept=".xlsx,.xls"
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onChange={setImportFile}
                  disabled={isUploading}
                  value={importFile}
                />

                {/* Upload Progress */}
                {uploadStatus !== 'idle' && (
                  <Card withBorder p="md">
                    <Stack gap="sm">
                      {importFile && (
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>File: {importFile.name}</Text>
                          <Text size="sm" c="dimmed">
                            {(importFile.size / 1024 / 1024).toFixed(2)} MB
                          </Text>
                        </Group>
                      )}

                      {uploadStatus === 'uploading' && (
                        <div>
                          <Group justify="space-between" mb="xs">
                            <Text size="sm" fw={500}>📤 Uploading file...</Text>
                            <Text size="sm" c="dimmed">{Math.round(uploadProgress)}%</Text>
                          </Group>
                          <Progress value={uploadProgress} size="lg" animated color="blue" />
                        </div>
                      )}

                      {uploadStatus === 'processing' && (
                        <div>
                          <Group justify="space-between" mb="xs">
                            <Group gap="xs">
                              <Loader size="sm" />
                              <Text size="sm" fw={500}>⚙️ Processing Excel data...</Text>
                            </Group>
                            <Text size="sm" c="dimmed">Importing guests</Text>
                          </Group>
                          <Progress value={100} size="lg" animated striped color="orange" />
                          <Text size="xs" c="dimmed" mt="xs">
                            Reading Excel file and creating tenant accounts...
                          </Text>
                        </div>
                      )}

                      {uploadStatus === 'complete' && uploadResults && (
                        <Alert color="green" icon={<IconInfoCircle size={16} />}>
                          <Text fw={500} c="green">🎉 Import Completed Successfully!</Text>
                          <Stack gap="xs" mt="xs">
                            <Group>
                              <Text size="sm">
                                ✅ Successfully imported: <Text span fw={700}>{uploadResults.success}</Text> guests
                              </Text>
                            </Group>
                            <Group>
                              <Text size="sm">
                                📊 Total processed: <Text span fw={700}>{uploadResults.total}</Text> rows
                              </Text>
                            </Group>
                            {uploadResults.errors.length > 0 && (
                              <>
                                <Text size="sm" c="red">
                                  ❌ Errors: <Text span fw={700}>{uploadResults.errors.length}</Text>
                                </Text>
                                <List size="sm" spacing="xs">
                                  {uploadResults.errors.slice(0, 5).map((error: string, index: number) => (
                                    <List.Item key={index}>{error}</List.Item>
                                  ))}
                                  {uploadResults.errors.length > 5 && (
                                    <List.Item>... and {uploadResults.errors.length - 5} more errors</List.Item>
                                  )}
                                </List>
                              </>
                            )}
                          </Stack>
                        </Alert>
                      )}

                      {uploadStatus === 'error' && (
                        <Alert color="red" icon={<IconInfoCircle size={16} />}>
                          <Text fw={500} c="red">💥 Upload Failed</Text>
                          <Text size="sm" mt="xs">
                            There was an error processing your file. Please check the file format and try again.
                          </Text>
                        </Alert>
                      )}
                    </Stack>
                  </Card>
                )}

                <Group justify="flex-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      resetUpload();
                      closeImport();
                    }}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Cancel'}
                  </Button>
                  
                  {uploadStatus === 'complete' && (
                    <Button 
                      onClick={resetUpload}
                      leftSection={<IconUpload size={16} />}
                    >
                      Upload Another File
                    </Button>
                  )}
                  
                  {uploadStatus === 'idle' && (
                    <Button 
                      onClick={() => importFile && handleChunkedUpload(importFile)}
                      disabled={!importFile || isUploading}
                      leftSection={<IconUpload size={16} />}
                    >
                      Import Tenants
                    </Button>
                  )}
                  
                  {uploadStatus === 'error' && (
                    <Button 
                      onClick={() => importFile && handleChunkedUpload(importFile)}
                      disabled={!importFile}
                      leftSection={<IconUpload size={16} />}
                      color="red"
                    >
                      Retry Upload
                    </Button>
                  )}
                </Group>
              </Stack>
            </Stack>
          </Modal>
        </Stack>
    </DashboardLayout>
  );
}
