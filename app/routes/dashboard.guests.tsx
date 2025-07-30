import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
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
} from "@mantine/core";
import { format } from "date-fns";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconEdit, IconInfoCircle, IconTrash, IconSearch } from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
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
        orderBy: { createdAt: "desc" },
        take: 3, // Show only last 3 bookings
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ user, guests });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "create") {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const phone = formData.get("phone") as string;
      const address = formData.get("address") as string;

      if (!email || !password || !firstName || !lastName) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }

      // Check if email already exists
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        return json({ error: "A user with this email already exists" }, { status: 400 });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

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
          temporaryPassword: password, // Send the original password in the email
        });
        console.log(`Welcome email sent to ${email}`);
      } catch (emailError) {
        console.error(`Failed to send welcome email to ${email}:`, emailError);
        // Don't fail the user creation if email fails
      }

      return json({ success: "Guest created successfully and welcome email sent!" });
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
  const { user, guests } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editingGuest, setEditingGuest] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Filter guests based on search query and status
  const filteredGuests = useMemo(() => {
    let filtered = guests.filter((guest) => {
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

  const handleEdit = (guest: any) => {
    setEditingGuest(guest);
    openEdit();
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

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Guests Management</Title>
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Add Guest
            </Button>
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
                    <div>
                      <Text fw={500}>
                        {guest.firstName} {guest.lastName}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {guest.email}
                      </Text>
                    </div>
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
                      </div>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No bookings
                      </Text>
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
                          color="blue"
                          onClick={() => handleEdit(guest)}
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
        </Card>

        {/* Add Guest Modal */}
        <Modal opened={opened} onClose={close} title="Add New Guest" size="lg">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Stack>
              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="John"
                  name="firstName"
                  required
                />
                <TextInput
                  label="Last Name"
                  placeholder="Doe"
                  name="lastName"
                  required
                />
              </Group>

              <TextInput
                label="Email"
                placeholder="john.doe@example.com"
                name="email"
                type="email"
                required
              />

              <TextInput
                label="Password"
                placeholder="Enter password"
                name="password"
                type="password"
                required
              />

              <TextInput
                label="Phone"
                placeholder="+1234567890"
                name="phone"
              />

              <TextInput
                label="Address"
                placeholder="123 Main Street, City"
                name="address"
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" onClick={close}>
                  Add Guest
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>

        {/* Edit Guest Modal */}
        <Modal opened={editOpened} onClose={closeEdit} title="Edit Guest" size="lg">
          {editingGuest && (
            <Form method="post">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="guestId" value={editingGuest.id} />
              <Stack>
                <Group grow>
                  <TextInput
                    label="First Name"
                    placeholder="John"
                    name="firstName"
                    defaultValue={editingGuest.firstName}
                    required
                  />
                  <TextInput
                    label="Last Name"
                    placeholder="Doe"
                    name="lastName"
                    defaultValue={editingGuest.lastName}
                    required
                  />
                </Group>

                <TextInput
                  label="Email"
                  value={editingGuest.email}
                  disabled
                  description="Email cannot be changed"
                />

                <TextInput
                  label="Phone"
                  placeholder="+1234567890"
                  name="phone"
                  defaultValue={editingGuest.phone || ""}
                />

                <TextInput
                  label="Address"
                  placeholder="123 Main Street, City"
                  name="address"
                  defaultValue={editingGuest.address || ""}
                />

                <Group justify="flex-end">
                  <Button variant="outline" onClick={closeEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" onClick={closeEdit}>
                    Update Guest
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
