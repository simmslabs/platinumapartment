import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useLocation, Outlet } from "@remix-run/react";
import { Title, Stack, Card, Text, Group, Button, Badge, Grid, Alert } from "@mantine/core";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { format } from "date-fns";

export const meta: MetaFunction = () => [
  { title: "My Profile - Apartment Management" },
  { name: "description", content: "View and manage your profile" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);

  const fullUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      address: true,
      gender: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
      bookings: {
        select: {
          id: true,
          status: true,
          checkIn: true,
          checkOut: true,
          room: { select: { number: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }
    }
  });

  if(!fullUser) throw new Response("User not found", { status: 404 });

  return json({ user: fullUser, sessionUser: user });
}

export default function ProfilePage() {
  const { user, sessionUser } = useLoaderData<typeof loader>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const passwordUpdated = params.get("passwordUpdated") === "1";

  if(location.pathname !== "/dashboard/profile") return <Outlet />

  return (
    <DashboardLayout user={sessionUser}>
      <Stack gap="md">
        {passwordUpdated && (
          <Alert color="green" variant="light" title="Password Updated" maw={600}>
            Your password was changed successfully.
          </Alert>
        )}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>My Profile</Title>
            <Text c="dimmed" size="sm">View your account details</Text>
          </div>
          <Group gap="sm">
            <Button component={Link} to="/dashboard/profile/password" variant="default">Change Password</Button>
            <Button component={Link} to="/dashboard" variant="light">Back to Dashboard</Button>
          </Group>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>Personal Information</Text>
                  <Badge color="blue" variant="light">{user.role}</Badge>
                </Group>
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Name</Text>
                    <Text fw={500}>{user.firstName} {user.lastName}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Email</Text>
                    <Text fw={500}>{user.email}</Text>
                  </Grid.Col>
                  {user.phone && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Phone</Text>
                      <Text fw={500}>{user.phone}</Text>
                    </Grid.Col>
                  )}
                  {user.address && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Address</Text>
                      <Text fw={500}>{user.address}</Text>
                    </Grid.Col>
                  )}
                  {user.gender && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Gender</Text>
                      <Text fw={500}>{user.gender}</Text>
                    </Grid.Col>
                  )}
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Member Since</Text>
                    <Text fw={500}>{format(new Date(user.createdAt), 'MMM dd, yyyy')}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Last Updated</Text>
                    <Text fw={500}>{format(new Date(user.updatedAt), 'MMM dd, yyyy')}</Text>
                  </Grid.Col>
                </Grid>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder>
              <Stack gap="sm">
                <Text fw={600}>Recent Bookings</Text>
                {user.bookings.length === 0 && (
                  <Text size="sm" c="dimmed">No bookings yet</Text>
                )}
                {user.bookings.map(b => (
                  <Card key={b.id} withBorder p="sm" radius="sm">
                    <Stack gap={2}>
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>Room {b.room.number}</Text>
                        <Badge size="sm" color={b.status === 'CHECKED_IN' ? 'green' : b.status === 'CONFIRMED' ? 'blue' : 'gray'}>{b.status}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">{format(new Date(b.checkIn), 'MMM dd')} - {format(new Date(b.checkOut), 'MMM dd')}</Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </DashboardLayout>
  );
}