import {
  AppShell,
  Text,
  Group,
  NavLink,
  Button,
  Avatar,
  Menu,
  Burger,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Form, Link } from "@remix-run/react";
import {
  IconDashboard,
  IconBed,
  IconCalendar,
  IconUsers,
  IconCreditCard,
  IconSettings,
  IconLogout,
  IconTool,
  IconStar,
  IconChartBar,
  IconBuildingStore,
  IconClockHour2,
  IconShield,
  IconReport,
} from "@tabler/icons-react";
import type { User } from "@prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: Pick<User, "id" | "firstName" | "lastName" | "email" | "role"> | null;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [opened, { toggle }] = useDisclosure();

  const navigationItems = [
    { icon: IconDashboard, label: "Dashboard", link: "/dashboard" },
    { icon: IconClockHour2, label: "Monitoring", link: "/dashboard/monitoring" },
    { icon: IconBed, label: "Rooms", link: "/dashboard/rooms" },
    { icon: IconCalendar, label: "Bookings", link: "/dashboard/bookings" },
    { icon: IconUsers, label: "Guests", link: "/dashboard/guests" },
    { icon: IconUsers, label: "Users", link: "/dashboard/users" },
    { icon: IconCreditCard, label: "Payments", link: "/dashboard/payments" },
    { icon: IconCreditCard, label: "Payment Accounts", link: "/dashboard/payment-accounts" },
    { icon: IconShield, label: "Security Deposits", link: "/dashboard/security-deposits" },
    { icon: IconBuildingStore, label: "Services", link: "/dashboard/services" },
    { icon: IconTool, label: "Maintenance", link: "/dashboard/maintenance" },
    { icon: IconStar, label: "Reviews", link: "/dashboard/reviews" },
    { icon: IconChartBar, label: "Analytics", link: "/dashboard/analytics" },
    { icon: IconReport, label: "Reports", link: "/dashboard/reports" },
    { icon: IconSettings, label: "Settings", link: "/dashboard/settings" },
  ];

  // Filter navigation based on user role
  const filteredNavigation = navigationItems.filter((item) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "MANAGER") {
      return !["Settings", "Users"].includes(item.label);
    }
    if (user.role === "STAFF") {
      return ["Dashboard", "Monitoring", "Rooms", "Bookings", "Guests", "Payments", "Security Deposits", "Services", "Maintenance"].includes(item.label);
    }
    return ["Dashboard", "Bookings"].includes(item.label);
  });

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text size="xl" w={{ span: 150, xs: 150, md: "100%" }} fw={700} truncate c="blue">
              🏨 Platinum Apartment Management
            </Text>
          </Group>

          {user && (
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="subtle" leftSection={
                  <Avatar size="sm" radius="xl">
                    {user.firstName[0]}{user.lastName[0]}
                  </Avatar>
                }>
                  {user.firstName} {user.lastName}
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Account</Menu.Label>
                <Menu.Divider />
                <Form method="post" action="/logout">
                  <Menu.Item
                    type="submit"
                    leftSection={<IconLogout size={16} />}
                    c="red"
                  >
                    Logout
                  </Menu.Item>
                </Form>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {filteredNavigation.map((item) => (
            <NavLink
              key={item.label}
              component={Link}
              to={item.link}
              label={item.label}
              leftSection={<item.icon size={16} />}
              mb="xs"
            />
          ))}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
