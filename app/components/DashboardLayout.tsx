import {
  AppShell,
  Text,
  Avatar,
  Menu,
  Badge,
  Stack,
  ActionIcon,
  Group,
} from "@mantine/core";
import { Form, Link, useLocation } from "@remix-run/react";
import {
  IconBed,
  IconUsers,
  IconSettings,
  IconLogout,
  IconBuildingStore,
  IconClockHour2,
  IconReport,
  IconBell,
  IconChevronDown,
  IconChevronRight,
  IconActivity,
  IconHome,
  IconNetwork,
  IconPlayerPlay,
  IconCreditCard,
  IconChartBar,
  IconWallet,
  IconMenu2,
  IconPackage,
} from "@tabler/icons-react";
import type { User } from "@prisma/client";
import { useState, useEffect, useCallback } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: Pick<User, "id" | "firstName" | "lastName" | "email" | "role"> | null;
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [checkoutCount, setCheckoutCount] = useState(0);
  const location = useLocation();

  // Calculate checkout counts (overdue + upcoming)
  useEffect(() => {
    const calculateCheckouts = async () => {
      try {
        const response = await fetch('/api/checkout-status');
        if (response.ok) {
          const data = await response.json();
          const total = data.overdueCount + data.upcomingCount;
          setCheckoutCount(total);
        }
      } catch (error) {
        console.error('Failed to fetch checkout status:', error);
        setCheckoutCount(0);
      }
    };

    calculateCheckouts();
    const interval = setInterval(calculateCheckouts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const mainNavigationItems = [
    { icon: IconHome, label: "Dashboard", link: "/dashboard", isActive: location.pathname === "/dashboard" },
    { 
      icon: IconActivity, 
      label: "Monitoring", 
      link: "/dashboard/monitoring", 
      hasSubmenu: true,
      badge: checkoutCount > 0 ? checkoutCount.toString() : undefined,
      isActive: location.pathname.includes("/monitoring")
    },
    { icon: IconBed, label: "Rooms", link: "/dashboard/rooms", isActive: location.pathname.includes("/rooms") },
    { icon: IconUsers, label: "Tenants", link: "/dashboard/guests", isActive: location.pathname.includes("/guests") },
    { 
      icon: IconBell, 
      label: "Bookings", 
      link: "/dashboard/bookings", 
      isActive: location.pathname.includes("/bookings")
    },
  ];

  const propertyManagementItems = [
    { icon: IconBuildingStore, label: "Blocks", link: "/dashboard/blocks", isActive: location.pathname.includes("/blocks") },
    { icon: IconClockHour2, label: "Maintenance", link: "/dashboard/maintenance", isActive: location.pathname.includes("/maintenance") },
    { icon: IconPlayerPlay, label: "Services", link: "/dashboard/services", isActive: location.pathname.includes("/services") },
    { icon: IconPackage, label: "Assets", link: "/dashboard/assets", isActive: location.pathname.includes("/assets") },
  ];

  const financialItems = [
    { icon: IconCreditCard, label: "Payments", link: "/dashboard/payments", isActive: location.pathname.includes("/payments") },
    { icon: IconWallet, label: "Payment Accounts", link: "/dashboard/payment-accounts", isActive: location.pathname.includes("/payment-accounts") },
    { icon: IconNetwork, label: "Security Deposits", link: "/dashboard/security-deposits", isActive: location.pathname.includes("/security-deposits") },
  ];

  const bottomNavigationItems = [
    { icon: IconUsers, label: "Users", link: "/dashboard/users", isActive: location.pathname.includes("/users") },
    { icon: IconChartBar, label: "Analytics", link: "/dashboard/analytics", isActive: location.pathname.includes("/analytics") },
    { icon: IconReport, label: "Reports", link: "/dashboard/reports", isActive: location.pathname.includes("/reports") },
    { icon: IconSettings, label: "Settings", link: "/dashboard/settings", isActive: location.pathname.includes("/settings") },
  ];

  // Filter navigation based on user role
  const filteredMainNavigation = mainNavigationItems.filter((item) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "MANAGER") {
      return !["Users"].includes(item.label);
    }
    if (user.role === "STAFF") {
      return ["Dashboard", "Monitoring", "Rooms", "Tenants", "Bookings"].includes(item.label);
    }
    return ["Dashboard", "Monitoring"].includes(item.label);
  });

  const filteredPropertyManagement = user 
    ? (user.role === "ADMIN" || user.role === "MANAGER") 
      ? propertyManagementItems 
      : []
    : [];

  const filteredFinancialItems = financialItems.filter((item) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "MANAGER") {
      return !["Payment Accounts"].includes(item.label);
    }
    return ["Payments"].includes(item.label);
  });

  const filteredBottomNavigation = bottomNavigationItems.filter((item) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "MANAGER") {
      return !["Users"].includes(item.label);
    }
    return ["Settings"].includes(item.label);
  });

  // Handle navigation clicks on mobile
  const handleNavClick = useCallback(() => {
    // No longer needed for dropdown menu
  }, []);

  return (
    <>
      <AppShell
        header={{ height: { base: 60, md: 0 } }}
        navbar={{
          width: 280,
          breakpoint: "md",
          collapsed: { mobile: true, desktop: false },
        }}
        padding={0}
        styles={{
          root: {
            background: '#f8fafc',
            minHeight: '100vh',
          },
          main: {
            background: 'transparent',
            padding: 0,
          }
        }}
        classNames={{
          main: 'dashboard-main'
        }}
      >
        {/* Mobile Header */}
        <AppShell.Header hiddenFrom="md" className="mobile-header">
          <Group h="100%" px="md" justify="space-between">
            <Group>
              {/* Mobile Navigation Dropdown */}
              <Menu shadow="md" width={280} position="bottom-start">
                <Menu.Target>
                  <ActionIcon variant="transparent" size="lg">
                    <IconMenu2 size={20} color="white" />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {/* Main Navigation Section */}
                  <Menu.Label>Navigation</Menu.Label>
                  {filteredMainNavigation.map((item) => (
                    <Menu.Item
                      key={item.label}
                      component={Link}
                      to={item.link}
                      leftSection={<item.icon size={16} />}
                      rightSection={item.badge && (
                        <Badge size="xs" color="blue">
                          {item.badge}
                        </Badge>
                      )}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
                  
                  {/* Property Management Section */}
                  {filteredPropertyManagement.length > 0 && (
                    <>
                      <Menu.Divider />
                      <Menu.Label>Property</Menu.Label>
                      {filteredPropertyManagement.map((item) => (
                        <Menu.Item
                          key={item.label}
                          component={Link}
                          to={item.link}
                          leftSection={<item.icon size={16} />}
                        >
                          {item.label}
                        </Menu.Item>
                      ))}
                    </>
                  )}
                  
                  {/* Financial Section */}
                  {filteredFinancialItems.length > 0 && (
                    <>
                      <Menu.Divider />
                      <Menu.Label>Financial</Menu.Label>
                      {filteredFinancialItems.map((item) => (
                        <Menu.Item
                          key={item.label}
                          component={Link}
                          to={item.link}
                          leftSection={<item.icon size={16} />}
                        >
                          {item.label}
                        </Menu.Item>
                      ))}
                    </>
                  )}
                  
                  {/* Bottom Navigation Section */}
                  {filteredBottomNavigation.length > 0 && (
                    <>
                      <Menu.Divider />
                      <Menu.Label>System</Menu.Label>
                      {filteredBottomNavigation.map((item) => (
                        <Menu.Item
                          key={item.label}
                          component={Link}
                          to={item.link}
                          leftSection={<item.icon size={16} />}
                        >
                          {item.label}
                        </Menu.Item>
                      ))}
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
              
              <Group gap={8}>
                <IconBuildingStore size={20} color="white" />
                <Text c="white" fw={600} size="sm">
                  Platinum Apartments
                </Text>
              </Group>
            </Group>
            
            {/* Mobile User Menu */}
            {user && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="transparent" size="lg">
                    <Avatar
                      size="sm"
                      radius="xl"
                      name={`${user.firstName} ${user.lastName}`}
                      color="blue"
                    />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Account</Menu.Label>
                  <Menu.Item
                    component={Link}
                    to="/dashboard/profile"
                    leftSection={<IconSettings size={14} />}
                  >
                    Profile Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    component={Form}
                    action="/logout"
                    method="post"
                    leftSection={<IconLogout size={14} />}
                    color="red"
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </AppShell.Header>
        
        {/* Desktop Navbar - Hidden on mobile */}
        <AppShell.Navbar p={0} visibleFrom="md">
          <div className="modern-navbar">
            {/* Header Section */}
            <div className="navbar-header navbar-brand-desktop">
              <div className="brand-section">
                <div className="brand-logo">
                  <div className="logo-icon">
                    <IconBuildingStore size={24} color="white" />
                  </div>
                  <div className="brand-info">
                    <Text className="brand-name" style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>
                      Platinum Apartments
                    </Text>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Navigation */}
            <div className="navbar-content">
              <Stack gap={2}>
                {filteredMainNavigation.map((item) => (
                  <Link
                    key={item.label}
                    to={item.link}
                    className={`nav-item ${item.isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none' }}
                    onClick={handleNavClick}
                  >
                    <div className="nav-item-content">
                      <div className="nav-icon">
                        <item.icon size={18} />
                      </div>
                      <span className="nav-label">
                        {item.label}
                      </span>
                      {item.badge && (
                        <Badge size="xs" className="nav-badge">
                          {item.badge}
                        </Badge>
                      )}
                      {item.hasSubmenu && (
                        <IconChevronDown size={14} className="nav-chevron" />
                      )}
                    </div>
                  </Link>
                ))}
              </Stack>

              {/* Property Management Section */}
              {filteredPropertyManagement.length > 0 && (
                <div className="property-section">
                  <div className="section-label">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ color: '#8fa2b3', padding: '12px 16px 8px' }}>
                      PROPERTY
                    </Text>
                  </div>
                  <Stack gap={2}>
                    {filteredPropertyManagement.map((item) => (
                      <Link
                        key={item.label}
                        to={item.link}
                        className={`nav-item ${item.isActive ? 'active' : ''}`}
                        style={{ textDecoration: 'none' }}
                        onClick={handleNavClick}
                      >
                        <div className="nav-item-content">
                          <div className="nav-icon">
                            <item.icon size={18} />
                          </div>
                          <span className="nav-label">
                            {item.label}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </Stack>
                </div>
              )}

              {/* Financial Section */}
              {filteredFinancialItems.length > 0 && (
                <div className="financial-section">
                  <div className="section-label">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ color: '#8fa2b3', padding: '12px 16px 8px' }}>
                      FINANCIAL
                    </Text>
                  </div>
                  <Stack gap={2}>
                    {filteredFinancialItems.map((item) => (
                      <Link
                        key={item.label}
                        to={item.link}
                        className={`nav-item ${item.isActive ? 'active' : ''}`}
                        style={{ textDecoration: 'none' }}
                        onClick={handleNavClick}
                      >
                        <div className="nav-item-content">
                          <div className="nav-icon">
                            <item.icon size={18} />
                          </div>
                          <span className="nav-label">
                            {item.label}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </Stack>
                </div>
              )}

              {/* Bottom Navigation */}
              {filteredBottomNavigation.length > 0 && (
                <div className="bottom-section">
                  <div className="section-divider"></div>
                  <Stack gap={2}>
                    {filteredBottomNavigation.map((item) => (
                      <Link
                        key={item.label}
                        to={item.link}
                        className={`nav-item ${item.isActive ? 'active' : ''}`}
                        style={{ textDecoration: 'none' }}
                        onClick={handleNavClick}
                      >
                        <div className="nav-item-content">
                          <div className="nav-icon">
                            <item.icon size={18} />
                          </div>
                          <span className="nav-label">
                            {item.label}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </Stack>
                </div>
              )}

              {/* User Profile Section - Desktop */}
              {user && (
                <div className="user-section">
                  <Menu shadow="md" width={200} position="right-start">
                    <Menu.Target>
                      <div className="profile-section">
                        <Avatar
                          size="sm"
                          radius="xl"
                          name={`${user.firstName} ${user.lastName}`}
                          color="blue"
                          className="profile-avatar"
                        />
                        <div className="profile-info">
                          <Text className="profile-name">
                            {user.firstName} {user.lastName}
                          </Text>
                          <Text className="profile-email">
                            {user.role.toLowerCase()}
                          </Text>
                        </div>
                        <IconChevronRight size={14} className="profile-menu" />
                      </div>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Account</Menu.Label>
                      <Menu.Item
                        component={Link}
                        to="/dashboard/profile"
                        leftSection={<IconSettings size={14} />}
                      >
                        Profile Settings
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        component={Form}
                        action="/logout"
                        method="post"
                        leftSection={<IconLogout size={14} />}
                        color="red"
                      >
                        Logout
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </div>
              )}
            </div>
          </div>
        </AppShell.Navbar>

        <AppShell.Main>
          <div className="main-content">
            {children}
          </div>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
