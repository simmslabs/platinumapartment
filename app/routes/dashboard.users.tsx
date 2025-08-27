import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
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
  PasswordInput,
  ThemeIcon,
  Pagination,
  Center,
  Tooltip,
  Textarea,
} from "@mantine/core";
import { format } from "date-fns";
import { useDisclosure } from "@mantine/hooks";
import { 
  IconEdit, 
  IconTrash, 
  IconSearch, 
  IconUsers,
  IconUserPlus,
  IconEye,
  IconShield,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { User, Booking, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Users Management | Apartment Management" },
    { name: "description", content: "Manage system users and their roles" },
  ];
};

// Type for serialized data from loader (dates become strings)
type SerializedUser = Omit<User, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  bookings: (Omit<Booking, 'createdAt' | 'updatedAt' | 'checkIn' | 'checkOut'> & {
    createdAt: string;
    updatedAt: string;
    checkIn: string;
    checkOut: string;
  })[];
  _count: {
    bookings: number;
  };
};

export async function loader({ request }: LoaderFunctionArgs) {
  const currentUserId = await requireUserId(request);
  const currentUser = await getUser(request);
  
  // Only ADMIN users can access user management
  if (currentUser?.role !== "ADMIN") {
    throw new Response("Unauthorized", { status: 403 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || "";
  const role = url.searchParams.get("role") || "";
  const limit = 10;
  const offset = (page - 1) * limit;

  const where = {
    AND: [
      search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ]
      } : {},
      role ? { role: role as UserRole } : {},
    ]
  };

  const [users, totalUsers] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: { bookings: true }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    db.user.count({ where })
  ]);

  const totalPages = Math.ceil(totalUsers / limit);

  // Get user role statistics
  const roleStats = await db.user.groupBy({
    by: ["role"],
    _count: {
      role: true
    }
  });

  return json({ 
    users, 
    totalUsers, 
    totalPages, 
    currentPage: page, 
    search, 
    roleFilter: role,
    roleStats,
    currentUserId,
    user: currentUser
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const currentUserId = await requireUserId(request);
  const currentUser = await getUser(request);
  
  if (currentUser?.role !== "ADMIN") {
    return json({ success: false, errors: ["Unauthorized"] }, { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "create") {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const role = formData.get("role") as UserRole;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return json({ success: false, errors: ["All required fields must be filled"] }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ success: false, errors: ["Invalid email format"] }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return json({ success: false, errors: ["User with this email already exists"] }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return json({ success: false, errors: ["Password must be at least 8 characters long"] }, { status: 400 });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await db.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          phone: phone || null,
          address: address || null,
        }
      });

      return json({ success: true, message: `${role} user created successfully` });
    } catch (error) {
      console.error("Error creating user:", error);
      return json({ success: false, errors: ["Failed to create user"] }, { status: 500 });
    }
  }

  if (action === "update") {
    const userId = formData.get("userId") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const role = formData.get("role") as UserRole;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;

    // Prevent users from changing their own role
    if (userId === currentUserId) {
      return json({ success: false, errors: ["You cannot modify your own role"] }, { status: 400 });
    }

    try {
      await db.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          role,
          phone: phone || null,
          address: address || null,
        }
      });

      return json({ success: true, message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user:", error);
      return json({ success: false, errors: ["Failed to update user"] }, { status: 500 });
    }
  }

  if (action === "resetPassword") {
    const userId = formData.get("userId") as string;
    const newPassword = formData.get("newPassword") as string;

    if (!newPassword || newPassword.length < 8) {
      return json({ success: false, errors: ["Password must be at least 8 characters long"] }, { status: 400 });
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return json({ success: false, errors: ["Failed to reset password"] }, { status: 500 });
    }
  }

  if (action === "delete") {
    const userId = formData.get("userId") as string;

    // Prevent users from deleting themselves
    if (userId === currentUserId) {
      return json({ success: false, errors: ["You cannot delete your own account"] }, { status: 400 });
    }

    try {
      // Check if user has bookings
      const userWithBookings = await db.user.findUnique({
        where: { id: userId },
        include: { _count: { select: { bookings: true } } }
      });

      if (userWithBookings && userWithBookings._count.bookings > 0) {
        return json({ success: false, errors: ["Cannot delete user with existing bookings"] }, { status: 400 });
      }

      await db.user.delete({ where: { id: userId } });
      return json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return json({ success: false, errors: ["Failed to delete user"] }, { status: 500 });
    }
  }

  return json({ success: false, errors: ["Invalid action"] }, { status: 400 });
}

function getRoleBadgeColor(role: UserRole): string {
  switch (role) {
    case "ADMIN": return "red";
    case "MANAGER": return "blue";
    case "STAFF": return "green";
    case "GUEST": return "gray";
    default: return "gray";
  }
}

export default function UsersManagement() {
  const { 
    users, 
    totalUsers, 
    totalPages, 
    currentPage, 
    search, 
    roleFilter, 
    roleStats,
    currentUserId,
    user
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [resetPasswordOpened, { open: openResetPassword, close: closeResetPassword }] = useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  
  const [selectedUser, setSelectedUser] = useState<SerializedUser | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  const isSubmitting = navigation.state === "submitting";

  const handleEdit = (user: typeof users[0]) => {
    setSelectedUser(user as SerializedUser);
    openEdit();
  };

  const handleDelete = (user: typeof users[0]) => {
    setSelectedUser(user as SerializedUser);
    openDelete();
  };

  const handleResetPassword = (user: typeof users[0]) => {
    setSelectedUser(user as SerializedUser);
    openResetPassword();
  };

  const handleView = (user: typeof users[0]) => {
    setSelectedUser(user as SerializedUser);
    openView();
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="xl">
        {/* Header */}
        <Group>
          <ThemeIcon size="lg" color="blue">
            <IconUsers size={24} />
          </ThemeIcon>
          <div>
            <Title order={2}>Users Management</Title>
            <Text c="dimmed">Manage system users and their roles</Text>
          </div>
          <Button 
            leftSection={<IconUserPlus size={16} />} 
            onClick={openCreate}
            ml="auto"
          >
            Add User
          </Button>
        </Group>

        {/* Action Feedback */}
        {actionData?.success && actionData && 'message' in actionData && (
          <Alert
            icon={<IconCheck size={16} />}
            title="Success"
            color="green"
            variant="light"
          >
            {actionData.message}
          </Alert>
        )}

        {actionData && 'errors' in actionData && actionData.errors && (
          <Alert
            icon={<IconX size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            <ul>
              {actionData.errors.map((error: string, index: number) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Role Statistics */}
        <Grid>
          {roleStats.map((stat) => (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={stat.role}>
              <Card>
                <Group>
                  <ThemeIcon color={getRoleBadgeColor(stat.role)} size="lg">
                    <IconShield size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {stat.role}S
                    </Text>
                    <Text fw={700} size="xl">
                      {stat._count.role}
                    </Text>
                  </div>
                </Group>
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {/* Filters and Search */}
        <Card>
          <Form method="get">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Search Users"
                  placeholder="Search by name, email, or phone..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  name="search"
                  leftSection={<IconSearch size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Filter by Role"
                  placeholder="All Roles"
                  data={[
                    { value: "", label: "All Roles" },
                    { value: "ADMIN", label: "Admin" },
                    { value: "MANAGER", label: "Manager" },
                    { value: "STAFF", label: "Staff" },
                    { value: "GUEST", label: "Guest" },
                  ]}
                  defaultValue={roleFilter}
                  name="role"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 2 }}>
                <Button 
                  type="submit" 
                  fullWidth 
                  mt="xl"
                  leftSection={<IconSearch size={16} />}
                >
                  Filter
                </Button>
              </Grid.Col>
            </Grid>
          </Form>
        </Card>

        {/* Users Table */}
        <Card>
          <Stack>
            <Group>
              <Title order={3}>Users ({totalUsers})</Title>
            </Group>
            
            {users.length === 0 ? (
              <Center p="xl">
                <Stack align="center">
                  <IconUsers size={48} color="gray" />
                  <Text c="dimmed">No users found</Text>
                </Stack>
              </Center>
            ) : (
              <>
                <Table.ScrollContainer minWidth={800}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>User</Table.Th>
                        <Table.Th>Role</Table.Th>
                      <Table.Th>Contact</Table.Th>
                      <Table.Th>Bookings</Table.Th>
                      <Table.Th>Created</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.map((user) => (
                      <Table.Tr key={user.id}>
                        <Table.Td>
                          <div>
                            <Text fw={500}>
                              {user.firstName} {user.lastName}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {user.email}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getRoleBadgeColor(user.role)} variant="light">
                            {user.role}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <div>
                            {user.phone && (
                              <Text size="sm">📞 {user.phone}</Text>
                            )}
                            {user.address && (
                              <Text size="xs" c="dimmed">📍 {user.address}</Text>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue">
                            {user._count.bookings}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {format(new Date(user.createdAt), "MMM dd, yyyy")}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="View Details">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => handleView(user)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Edit User">
                              <ActionIcon
                                variant="subtle"
                                color="yellow"
                                onClick={() => handleEdit(user)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Reset Password">
                              <ActionIcon
                                variant="subtle"
                                color="orange"
                                onClick={() => handleResetPassword(user)}
                              >
                                <IconShield size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {user.id !== currentUserId && (
                              <Tooltip label="Delete User">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  onClick={() => handleDelete(user)}
                                  disabled={user._count.bookings > 0}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                </Table.ScrollContainer>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Center>
                    <Pagination
                      value={currentPage}
                      total={totalPages}
                      onChange={(page) => {
                        const params = new URLSearchParams();
                        params.set("page", page.toString());
                        if (search) params.set("search", search);
                        if (roleFilter) params.set("role", roleFilter);
                        window.location.search = params.toString();
                      }}
                    />
                  </Center>
                )}
              </>
            )}
          </Stack>
        </Card>

        {/* Create User Modal */}
        <Modal opened={createOpened} onClose={closeCreate} title="Add New User" size="lg">
          <Form method="post">
            <input type="hidden" name="_action" value="create" />
            <Stack>
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="First Name"
                    name="firstName"
                    required
                    placeholder="Enter first name"
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Last Name"
                    name="lastName"
                    required
                    placeholder="Enter last name"
                  />
                </Grid.Col>
              </Grid>
              
              <TextInput
                label="Email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
              />
              
              <PasswordInput
                label="Password"
                name="password"
                required
                placeholder="Enter secure password"
                description="Minimum 8 characters"
              />
              
              <Select
                label="Role"
                name="role"
                required
                data={[
                  { value: "ADMIN", label: "Admin" },
                  { value: "MANAGER", label: "Manager" },
                  { value: "STAFF", label: "Staff" },
                  { value: "GUEST", label: "Guest" },
                ]}
                placeholder="Select user role"
              />
              
              <TextInput
                label="Phone"
                name="phone"
                placeholder="Enter phone number"
              />
              
              <Textarea
                label="Address"
                name="address"
                placeholder="Enter address"
                rows={3}
              />
              
              <Group justify="flex-end">
                <Button variant="subtle" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Create User
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>

        {/* Edit User Modal */}
        <Modal opened={editOpened} onClose={closeEdit} title="Edit User" size="lg">
          {selectedUser && (
            <Form method="post">
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="userId" value={selectedUser.id} />
              <Stack>
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="First Name"
                      name="firstName"
                      required
                      defaultValue={selectedUser.firstName}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Last Name"
                      name="lastName"
                      required
                      defaultValue={selectedUser.lastName}
                    />
                  </Grid.Col>
                </Grid>
                
                <TextInput
                  label="Email"
                  value={selectedUser.email}
                  disabled
                  description="Email cannot be changed"
                />
                
                <Select
                  label="Role"
                  name="role"
                  required
                  defaultValue={selectedUser.role}
                  data={[
                    { value: "ADMIN", label: "Admin" },
                    { value: "MANAGER", label: "Manager" },
                    { value: "STAFF", label: "Staff" },
                    { value: "GUEST", label: "Guest" },
                  ]}
                  disabled={selectedUser.id === currentUserId}
                />
                
                <TextInput
                  label="Phone"
                  name="phone"
                  defaultValue={selectedUser.phone || ""}
                />
                
                <Textarea
                  label="Address"
                  name="address"
                  defaultValue={selectedUser.address || ""}
                  rows={3}
                />
                
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={closeEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    Update User
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>

        {/* Reset Password Modal */}
        <Modal opened={resetPasswordOpened} onClose={closeResetPassword} title="Reset Password">
          {selectedUser && (
            <Form method="post">
              <input type="hidden" name="_action" value="resetPassword" />
              <input type="hidden" name="userId" value={selectedUser.id} />
              <Stack>
                <Text>
                  Reset password for <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>?
                </Text>
                
                <PasswordInput
                  label="New Password"
                  name="newPassword"
                  required
                  placeholder="Enter new password"
                  description="Minimum 8 characters"
                />
                
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={closeResetPassword}>
                    Cancel
                  </Button>
                  <Button type="submit" color="orange" loading={isSubmitting}>
                    Reset Password
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>

        {/* Delete User Modal */}
        <Modal opened={deleteOpened} onClose={closeDelete} title="Delete User">
          {selectedUser && (
            <Form method="post">
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="userId" value={selectedUser.id} />
              <Stack>
                <Alert
                  icon={<IconAlertTriangle size={16} />}
                  title="Warning"
                  color="red"
                  variant="light"
                >
                  This action cannot be undone. Are you sure you want to delete{" "}
                  <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>?
                </Alert>
                
                {selectedUser._count.bookings > 0 && (
                  <Alert
                    icon={<IconX size={16} />}
                    title="Cannot Delete"
                    color="red"
                  >
                    This user has {selectedUser._count.bookings} booking(s) and cannot be deleted.
                  </Alert>
                )}
                
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={closeDelete}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    color="red" 
                    loading={isSubmitting}
                    disabled={selectedUser._count.bookings > 0}
                  >
                    Delete User
                  </Button>
                </Group>
              </Stack>
            </Form>
          )}
        </Modal>

        {/* View User Modal */}
        <Modal opened={viewOpened} onClose={closeView} title="User Details" size="lg">
          {selectedUser && (
            <Stack>
              <Grid>
                <Grid.Col span={6}>
                  <Card>
                    <Stack>
                      <Title order={4}>Personal Information</Title>
                      <div>
                        <Text size="sm" c="dimmed">Name</Text>
                        <Text fw={500}>{selectedUser.firstName} {selectedUser.lastName}</Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">Email</Text>
                        <Text>{selectedUser.email}</Text>
                      </div>
                      <div>
                        <Text size="sm" c="dimmed">Role</Text>
                        <Badge color={getRoleBadgeColor(selectedUser.role)} variant="light">
                          {selectedUser.role}
                        </Badge>
                      </div>
                      {selectedUser.phone && (
                        <div>
                          <Text size="sm" c="dimmed">Phone</Text>
                          <Text>{selectedUser.phone}</Text>
                        </div>
                      )}
                      {selectedUser.address && (
                        <div>
                          <Text size="sm" c="dimmed">Address</Text>
                          <Text>{selectedUser.address}</Text>
                        </div>
                      )}
                      <div>
                        <Text size="sm" c="dimmed">Member Since</Text>
                        <Text>{format(new Date(selectedUser.createdAt), "MMMM dd, yyyy")}</Text>
                      </div>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card>
                    <Stack>
                      <Title order={4}>Booking History</Title>
                      <Text>
                        Total Bookings: <strong>{selectedUser._count.bookings}</strong>
                      </Text>
                      {selectedUser.bookings.length > 0 ? (
                        <Stack gap="xs">
                          {selectedUser.bookings.map((booking) => (
                            <Card key={booking.id} p="xs" withBorder>
                              <Text size="sm" fw={500}>
                                {format(new Date(booking.checkIn), "MMM dd")} - {format(new Date(booking.checkOut), "MMM dd, yyyy")}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Status: {booking.status} | Total: ₵{booking.totalAmount}
                              </Text>
                            </Card>
                          ))}
                        </Stack>
                      ) : (
                        <Text c="dimmed" size="sm">No bookings yet</Text>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>
            </Stack>
          )}
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
