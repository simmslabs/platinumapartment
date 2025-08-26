import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, Outlet, useLocation } from "@remix-run/react";
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
} from "@mantine/core";
import { format } from "date-fns";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconTrash, IconSearch, IconEye, IconUsers, IconWallet, IconTrendingUp, IconClock, IconUpload, IconDownload, IconFileSpreadsheet } from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { User, Booking } from "@prisma/client";
import bcrypt from "bcryptjs";
import { useState, useMemo } from "react";
import { emailService } from "~/utils/email.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Guests - Apartment Management" },
    { name: "description", content: "Manage apartment guests" },
  ];
};

type GuestWithBookings = User & {
  bookings: Booking[];
};

type LoaderGuest = typeof loader extends (...args: any[]) => Promise<{ json: () => Promise<{ guests: infer T }> }> ? T extends any[] ? T[0] : never : never;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const guests = await db.user.findMany({
    where: { role: "GUEST" },
    include: {
      bookings: {
        include: {
          payment: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3, // Show only last 3 bookings
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate overall statistics
  const totalRevenue = guests.reduce((sum, guest) => 
    sum + guest.bookings.reduce((bookingSum, booking) => bookingSum + booking.totalAmount, 0), 0
  );

  const totalPaid = guests.reduce((sum, guest) => 
    sum + guest.bookings.reduce((bookingSum, booking) => 
      bookingSum + (booking.payment?.status === "COMPLETED" ? booking.payment.amount : 0), 0
    ), 0
  );

  const totalPending = guests.reduce((sum, guest) => 
    sum + guest.bookings.reduce((bookingSum, booking) => 
      bookingSum + (booking.payment?.status === "PENDING" ? booking.totalAmount : 0), 0
    ), 0
  );

  const activeGuests = guests.filter(guest => 
    guest.bookings.some(booking => ["CONFIRMED", "CHECKED_IN"].includes(booking.status))
  ).length;

  return json({ 
    user, 
    guests, 
    stats: {
      totalGuests: guests.length,
      activeGuests,
      totalRevenue,
      totalPaid,
      totalPending,
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

      if (!email || !firstName || !lastName) {
        return json({ error: "Email, first name, and last name are required" }, { status: 400 });
      }

      // Check if email already exists
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        return json({ error: "A user with this email already exists" }, { status: 400 });
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
      const newUser = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone: phone || null,
          address: address || null,
          role: "GUEST",
        },
      });

      // Send welcome email (don't block the response if email fails)
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

      return json({ success: "Guest created successfully with auto-generated password sent via email!" });
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

      return json({ success: "Guest updated successfully" });
    }

    if (intent === "delete") {
      const guestId = formData.get("guestId") as string;

      // Check if guest has any active bookings
      const activeBookings = await db.booking.findMany({
        where: {
          userId: guestId,
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
      });

      if (activeBookings.length > 0) {
        return json({ error: "Cannot delete guest with active bookings" }, { status: 400 });
      }

      await db.user.delete({
        where: { id: guestId },
      });

      return json({ success: "Guest deleted successfully" });
    }

    if (intent === "import") {
      // Handle Excel import
      const file = formData.get("file") as File;
      
      if (!file) {
        return json({ error: "No file provided" }, { status: 400 });
      }

      try {
        // Import via API route
        const importFormData = new FormData();
        importFormData.append("intent", "import");
        importFormData.append("file", file);

        const response = await fetch(`${new URL(request.url).origin}/api/guests/import`, {
          method: "POST",
          body: importFormData,
        });

        const result = await response.json();
        
        if (response.ok) {
          return json({ success: result.message, importResults: result.results });
        } else {
          return json({ error: result.error }, { status: response.status });
        }
      } catch (error: any) {
        console.error("Import error:", error);
        return json({ error: "Failed to import guests" }, { status: 500 });
      }
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Guest action error:", error);
    if (error.code === "P2002") {
      return json({ error: "Email already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Guests() {
  const { user, guests, stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [importFile, setImportFile] = useState<File | null>(null);

  // Filter guests based on search query and status
  const filteredGuests = useMemo(() => {
    const filtered = guests.filter((guest) => {
      const matchesSearch = 
        guest.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (guest.phone && guest.phone.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "active" && guest.bookings.some(b => ["CONFIRMED", "CHECKED_IN"].includes(b.status))) ||
        (filterStatus === "inactive" && !guest.bookings.some(b => ["CONFIRMED", "CHECKED_IN"].includes(b.status)));

      return matchesSearch && matchesStatus;
    });

    return filtered;
  }, [guests, searchQuery, filterStatus]);

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
            <Title order={2}>Guests Management</Title>
            {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
              <Group>
                <Button 
                  leftSection={<IconUpload size={16} />} 
                  onClick={openImport}
                  variant="outline"
                >
                  Import Guests
                </Button>
                <Button 
                  component={Link}
                  to="/dashboard/guests/new"
                  leftSection={<IconPlus size={16} />}
                >
                  Add Guest
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
                    <Text c="dimmed" size="sm">Total Guests</Text>
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
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                style={{ flexGrow: 1 }}
              />
              <Select
                placeholder="Filter by status"
                value={filterStatus}
                onChange={(value) => setFilterStatus(value || "all")}
                data={[
                  { value: "all", label: "All Guests" },
                  { value: "active", label: "Active Guests" },
                  { value: "inactive", label: "Inactive Guests" },
                ]}
                style={{ minWidth: 150 }}
              />
            </Group>
          </Card>

          <Card>
            <Group justify="space-between" mb="md">
              <Text size="sm" c="dimmed">
                Showing {filteredGuests.length} of {guests.length} guests
              </Text>
            </Group>
            <Table.ScrollContainer minWidth={800}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Guest Information</Table.Th>
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
                    <Table.Td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
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
                          <Form method="post" style={{ display: "inline" }}>
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="guestId" value={guest.id} />
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              type="submit"
                              onClick={(e) => {
                                if (!confirm("Are you sure you want to delete this guest?")) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Form>
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

          {/* Import Guests Modal */}
          <Modal opened={importOpened} onClose={closeImport} title="Import Guests from Excel" size="lg">
            <Stack>
              <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                Upload an Excel file (.xlsx) with guest information. 
                <Text size="sm" mt="xs">
                  Required columns: firstName, lastName, email
                  <br />
                  Optional columns: phone, address
                  <br />
                  <Text size="xs" c="dimmed">Note: Passwords will be auto-generated and sent via email</Text>
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

              <Form method="post" encType="multipart/form-data">
                <input type="hidden" name="intent" value="import" />
                <Stack>
                  <FileInput
                    label="Select Excel File"
                    placeholder="Choose .xlsx file"
                    accept=".xlsx,.xls"
                    name="file"
                    leftSection={<IconFileSpreadsheet size={16} />}
                    onChange={setImportFile}
                    required
                  />

                  {actionData && "importResults" in actionData && (
                    <Card withBorder p="md">
                      <Stack gap="xs">
                        <Text fw={500} c="green">Import Results:</Text>
                        <Text size="sm">
                          ✅ Successfully imported: {actionData.importResults.success} guests
                        </Text>
                        <Text size="sm">
                          📊 Total processed: {actionData.importResults.total} rows
                        </Text>
                        {actionData.importResults.errors.length > 0 && (
                          <>
                            <Text size="sm" c="red">
                              ❌ Errors: {actionData.importResults.errors.length}
                            </Text>
                            <List size="sm" spacing="xs">
                              {actionData.importResults.errors.slice(0, 5).map((error: string, index: number) => (
                                <List.Item key={index}>{error}</List.Item>
                              ))}
                              {actionData.importResults.errors.length > 5 && (
                                <List.Item>... and {actionData.importResults.errors.length - 5} more errors</List.Item>
                              )}
                            </List>
                          </>
                        )}
                      </Stack>
                    </Card>
                  )}

                  <Group justify="flex-end">
                    <Button variant="outline" onClick={closeImport}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={!importFile}
                      leftSection={<IconUpload size={16} />}
                    >
                      Import Guests
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
