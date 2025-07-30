import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable, createCookieSessionStorage, redirect, json } from "@remix-run/node";
import { RemixServer, Outlet, Meta, Links, ScrollRestoration, Scripts, Link, Form, useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { ColorSchemeScript, MantineProvider, AppShell, Group, Burger, Text, Menu, Button, Avatar, NavLink, Stack, Title, Alert, Card, Table, Badge, Select, Modal, Textarea, NumberInput, ThemeIcon, Center, Grid, SimpleGrid, Progress, TextInput, ActionIcon, Paper, Divider, Container, PasswordInput, Anchor } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { useDisclosure } from "@mantine/hooks";
import { IconDashboard, IconClockHour2, IconBed, IconCalendar, IconUsers, IconCreditCard, IconBuildingStore, IconTool, IconStar, IconChartBar, IconSettings, IconLogout, IconPlus, IconInfoCircle, IconAlertTriangle, IconClock, IconCalendarTime, IconUser, IconCurrencyDollar, IconTrendingUp, IconTrendingDown, IconSearch, IconTrash, IconEdit, IconFilter, IconWifi, IconCar, IconPool, IconChefHat, IconMassage } from "@tabler/icons-react";
import { format, differenceInHours, differenceInMinutes, isToday, isTomorrow } from "date-fns";
import bcrypt from "bcryptjs";
import "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { useState, useEffect, useMemo } from "react";
import { DateInput } from "@mantine/dates";
import { Resend } from "resend";
const ABORT_DELAY = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, remixContext, loadContext) {
  return isbot(request.headers.get("user-agent") || "") ? handleBotRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixContext
  ) : handleBrowserRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixContext
  );
}
function handleBotRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url,
          abortDelay: ABORT_DELAY
        }
      ),
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
function handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url,
          abortDelay: ABORT_DELAY
        }
      ),
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous"
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
  }
];
function Layout({ children }) {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {}),
      /* @__PURE__ */ jsx(ColorSchemeScript, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(
        MantineProvider,
        {
          theme: {
            primaryColor: "blue",
            fontFamily: "Inter, sans-serif"
          },
          children: /* @__PURE__ */ jsxs(ModalsProvider, { children: [
            /* @__PURE__ */ jsx(Notifications, {}),
            children
          ] })
        }
      ),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Layout,
  default: App,
  links
}, Symbol.toStringTag, { value: "Module" }));
function DashboardLayout({ children, user }) {
  const [opened, { toggle }] = useDisclosure();
  const navigationItems = [
    { icon: IconDashboard, label: "Dashboard", link: "/dashboard" },
    { icon: IconClockHour2, label: "Monitoring", link: "/dashboard/monitoring" },
    { icon: IconBed, label: "Rooms", link: "/dashboard/rooms" },
    { icon: IconCalendar, label: "Bookings", link: "/dashboard/bookings" },
    { icon: IconUsers, label: "Guests", link: "/dashboard/guests" },
    { icon: IconCreditCard, label: "Payments", link: "/dashboard/payments" },
    { icon: IconBuildingStore, label: "Services", link: "/dashboard/services" },
    { icon: IconTool, label: "Maintenance", link: "/dashboard/maintenance" },
    { icon: IconStar, label: "Reviews", link: "/dashboard/reviews" },
    { icon: IconChartBar, label: "Analytics", link: "/dashboard/analytics" },
    { icon: IconSettings, label: "Settings", link: "/dashboard/settings" }
  ];
  const filteredNavigation = navigationItems.filter((item) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "MANAGER") {
      return !["Settings"].includes(item.label);
    }
    if (user.role === "STAFF") {
      return ["Dashboard", "Rooms", "Bookings", "Guests", "Services", "Maintenance"].includes(item.label);
    }
    return ["Dashboard", "Bookings"].includes(item.label);
  });
  return /* @__PURE__ */ jsxs(
    AppShell,
    {
      header: { height: 60 },
      navbar: {
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !opened }
      },
      padding: "md",
      children: [
        /* @__PURE__ */ jsx(AppShell.Header, { children: /* @__PURE__ */ jsxs(Group, { h: "100%", px: "md", justify: "space-between", children: [
          /* @__PURE__ */ jsxs(Group, { children: [
            /* @__PURE__ */ jsx(Burger, { opened, onClick: toggle, hiddenFrom: "sm", size: "sm" }),
            /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, c: "blue", children: "🏨 Apartment Management" })
          ] }),
          user && /* @__PURE__ */ jsxs(Menu, { shadow: "md", width: 200, children: [
            /* @__PURE__ */ jsx(Menu.Target, { children: /* @__PURE__ */ jsxs(Button, { variant: "subtle", leftSection: /* @__PURE__ */ jsxs(Avatar, { size: "sm", radius: "xl", children: [
              user.firstName[0],
              user.lastName[0]
            ] }), children: [
              user.firstName,
              " ",
              user.lastName
            ] }) }),
            /* @__PURE__ */ jsxs(Menu.Dropdown, { children: [
              /* @__PURE__ */ jsx(Menu.Label, { children: "Account" }),
              /* @__PURE__ */ jsx(Menu.Item, { component: Link, to: "/dashboard/profile", children: "Profile" }),
              /* @__PURE__ */ jsx(Menu.Divider, {}),
              /* @__PURE__ */ jsx(Form, { method: "post", action: "/logout", children: /* @__PURE__ */ jsx(
                Menu.Item,
                {
                  type: "submit",
                  leftSection: /* @__PURE__ */ jsx(IconLogout, { size: 16 }),
                  c: "red",
                  children: "Logout"
                }
              ) })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx(AppShell.Navbar, { p: "md", children: /* @__PURE__ */ jsx(AppShell.Section, { grow: true, children: filteredNavigation.map((item) => /* @__PURE__ */ jsx(
          NavLink,
          {
            component: Link,
            to: item.link,
            label: item.label,
            leftSection: /* @__PURE__ */ jsx(item.icon, { size: 16 }),
            mb: "xs"
          },
          item.label
        )) }) }),
        /* @__PURE__ */ jsx(AppShell.Main, { children })
      ]
    }
  );
}
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new PrismaClient({
  log: ["query"]
});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
process.env.JWT_SECRET || "fallback-secret";
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}
async function createUser(data) {
  const hashedPassword = await hashPassword(data.password);
  return db.user.create({
    data: {
      ...data,
      password: hashedPassword
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phone: true,
      address: true,
      createdAt: true
    }
  });
}
async function verifyUser(email, password) {
  const user = await db.user.findUnique({
    where: { email }
  });
  if (!user) return null;
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
async function getUserById(id) {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phone: true,
      address: true,
      createdAt: true
    }
  });
}
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-session-secret";
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production"
  }
});
async function createUserSession(userId, redirectTo) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
}
async function getUserSession(request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}
async function getUserId(request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}
async function requireUserId(request, redirectTo = new URL(request.url).pathname) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}
async function getUser(request) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }
  try {
    const user = await getUserById(userId);
    return user;
  } catch {
    throw logout(request);
  }
}
async function logout(request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
}
const meta$a = () => {
  return [
    { title: "Maintenance - Apartment Management" },
    { name: "description", content: "Manage apartment maintenance tasks" }
  ];
};
async function loader$c({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const maintenanceLogs = await db.maintenanceLog.findMany({
    include: {
      room: {
        select: { number: true, type: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const rooms = await db.room.findMany({
    select: { id: true, number: true, type: true },
    orderBy: { number: "asc" }
  });
  return json({ user, maintenanceLogs, rooms });
}
async function action$7({ request }) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  try {
    if (intent === "create") {
      const roomId = formData.get("roomId");
      const type = formData.get("type");
      const description = formData.get("description");
      const priority = formData.get("priority");
      const reportedBy = formData.get("reportedBy");
      const assignedTo = formData.get("assignedTo");
      const cost = formData.get("cost") ? parseFloat(formData.get("cost")) : null;
      if (!roomId || !type || !description || !priority) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }
      await db.maintenanceLog.create({
        data: {
          roomId,
          type,
          description,
          priority,
          reportedBy: reportedBy || null,
          assignedTo: assignedTo || null,
          cost,
          status: "PENDING"
        }
      });
      if (priority === "CRITICAL" || priority === "HIGH") {
        await db.room.update({
          where: { id: roomId },
          data: { status: "MAINTENANCE" }
        });
      }
      return json({ success: "Maintenance task created successfully" });
    }
    if (intent === "update-status") {
      const maintenanceId = formData.get("maintenanceId");
      const status = formData.get("status");
      const updateData = { status };
      if (status === "IN_PROGRESS") {
        updateData.startDate = /* @__PURE__ */ new Date();
      } else if (status === "COMPLETED") {
        updateData.endDate = /* @__PURE__ */ new Date();
      }
      const maintenanceLog = await db.maintenanceLog.update({
        where: { id: maintenanceId },
        data: updateData,
        include: { room: true }
      });
      if (status === "COMPLETED") {
        await db.room.update({
          where: { id: maintenanceLog.roomId },
          data: { status: "AVAILABLE" }
        });
      }
      return json({ success: "Maintenance status updated successfully" });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Maintenance action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Maintenance() {
  const { user, maintenanceLogs, rooms } = useLoaderData();
  const actionData = useActionData();
  const [opened, { open, close }] = useDisclosure(false);
  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "yellow";
      case "IN_PROGRESS":
        return "blue";
      case "COMPLETED":
        return "green";
      case "CANCELLED":
        return "red";
      default:
        return "gray";
    }
  };
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "LOW":
        return "green";
      case "MEDIUM":
        return "yellow";
      case "HIGH":
        return "orange";
      case "CRITICAL":
        return "red";
      default:
        return "gray";
    }
  };
  const getTypeIcon = (type) => {
    return /* @__PURE__ */ jsx(IconTool, { size: 16 });
  };
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: "Maintenance Management" }),
      ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsx(Button, { leftSection: /* @__PURE__ */ jsx(IconPlus, { size: 16 }), onClick: open, children: "New Maintenance Task" })
    ] }),
    (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        children: actionData.error
      }
    ),
    (actionData == null ? void 0 : actionData.success) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Success",
        color: "green",
        children: actionData.success
      }
    ),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Table, { striped: true, highlightOnHover: true, children: [
      /* @__PURE__ */ jsx(Table.Thead, { children: /* @__PURE__ */ jsxs(Table.Tr, { children: [
        /* @__PURE__ */ jsx(Table.Th, { children: "Room" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Type" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Description" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Priority" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Status" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Reported" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Cost" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Actions" })
      ] }) }),
      /* @__PURE__ */ jsx(Table.Tbody, { children: maintenanceLogs.map((log) => /* @__PURE__ */ jsxs(Table.Tr, { children: [
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
            "Room ",
            log.room.number
          ] }),
          /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: log.room.type.replace("_", " ") })
        ] }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs(Group, { gap: "xs", children: [
          getTypeIcon(log.type),
          /* @__PURE__ */ jsx(Text, { size: "sm", children: log.type.replace("_", " ") })
        ] }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Text, { size: "sm", lineClamp: 2, children: log.description }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Badge, { color: getPriorityColor(log.priority), size: "sm", children: log.priority }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Badge, { color: getStatusColor(log.status), size: "sm", children: log.status.replace("_", " ") }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Text, { size: "sm", children: format(new Date(log.createdAt), "MMM dd, yyyy") }),
          log.reportedBy && /* @__PURE__ */ jsxs(Text, { size: "xs", c: "dimmed", children: [
            "by ",
            log.reportedBy
          ] })
        ] }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: log.cost ? `$${log.cost}` : "N/A" }),
        /* @__PURE__ */ jsx(Table.Td, { children: ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsxs(Form, { method: "post", style: { display: "inline" }, children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "update-status" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "maintenanceId", value: log.id }),
          /* @__PURE__ */ jsx(
            Select,
            {
              name: "status",
              size: "xs",
              data: [
                { value: "PENDING", label: "Pending" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CANCELLED", label: "Cancelled" }
              ],
              defaultValue: log.status,
              onChange: (value) => {
                if (value) {
                  const form = new FormData();
                  form.append("intent", "update-status");
                  form.append("maintenanceId", log.id);
                  form.append("status", value);
                  fetch("/dashboard/maintenance", {
                    method: "POST",
                    body: form
                  }).then(() => window.location.reload());
                }
              }
            }
          )
        ] }) })
      ] }, log.id)) })
    ] }) }),
    /* @__PURE__ */ jsx(Modal, { opened, onClose: close, title: "Create Maintenance Task", size: "lg", children: /* @__PURE__ */ jsxs(Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "create" }),
      /* @__PURE__ */ jsxs(Stack, { children: [
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Room",
            placeholder: "Select room",
            name: "roomId",
            data: rooms.map((room) => ({
              value: room.id,
              label: `Room ${room.number} - ${room.type.replace("_", " ")}`
            })),
            required: true,
            searchable: true
          }
        ),
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Maintenance Type",
            placeholder: "Select type",
            name: "type",
            data: [
              { value: "CLEANING", label: "Cleaning" },
              { value: "REPAIR", label: "Repair" },
              { value: "INSPECTION", label: "Inspection" },
              { value: "UPGRADE", label: "Upgrade" },
              { value: "PREVENTIVE", label: "Preventive" }
            ],
            required: true
          }
        ),
        /* @__PURE__ */ jsx(
          Textarea,
          {
            label: "Description",
            placeholder: "Describe the maintenance task...",
            name: "description",
            required: true,
            rows: 3
          }
        ),
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Priority",
            placeholder: "Select priority",
            name: "priority",
            data: [
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "CRITICAL", label: "Critical" }
            ],
            required: true
          }
        ),
        /* @__PURE__ */ jsxs(Group, { grow: true, children: [
          /* @__PURE__ */ jsx(
            Textarea,
            {
              label: "Reported By",
              placeholder: "Staff member name",
              name: "reportedBy",
              rows: 1
            }
          ),
          /* @__PURE__ */ jsx(
            Textarea,
            {
              label: "Assigned To",
              placeholder: "Maintenance staff",
              name: "assignedTo",
              rows: 1
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          NumberInput,
          {
            label: "Estimated Cost",
            placeholder: "100",
            name: "cost",
            min: 0,
            prefix: "$",
            decimalScale: 2
          }
        ),
        /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", onClick: close, children: "Create Task" })
        ] })
      ] })
    ] }) })
  ] }) });
}
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7,
  default: Maintenance,
  loader: loader$c,
  meta: meta$a
}, Symbol.toStringTag, { value: "Module" }));
const meta$9 = () => {
  return [
    { title: "Real-time Monitoring - Apartment Management" },
    { name: "description", content: "Monitor upcoming checkouts and tenant activities" }
  ];
};
async function loader$b({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const now = /* @__PURE__ */ new Date();
  new Date(now.getTime() + 24 * 60 * 60 * 1e3);
  const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1e3);
  const upcomingCheckouts = await db.booking.findMany({
    where: {
      checkOut: {
        gte: now,
        lte: next48Hours
      },
      status: "CHECKED_IN"
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true }
      },
      room: {
        select: { number: true, type: true }
      }
    },
    orderBy: { checkOut: "asc" }
  });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const todayCheckIns = await db.booking.findMany({
    where: {
      checkIn: {
        gte: startOfToday,
        lt: endOfToday
      },
      status: { in: ["CONFIRMED", "CHECKED_IN"] }
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true }
      },
      room: {
        select: { number: true, type: true }
      }
    },
    orderBy: { checkIn: "asc" }
  });
  const overdueCheckouts = await db.booking.findMany({
    where: {
      checkOut: {
        lt: now
      },
      status: "CHECKED_IN"
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true }
      },
      room: {
        select: { number: true, type: true }
      }
    },
    orderBy: { checkOut: "asc" }
  });
  return json({
    user,
    upcomingCheckouts,
    todayCheckIns,
    overdueCheckouts,
    currentTime: now.toISOString()
  });
}
function Monitoring() {
  const { user, upcomingCheckouts, todayCheckIns, overdueCheckouts, currentTime } = useLoaderData();
  const [currentDateTime, setCurrentDateTime] = useState(new Date(currentTime));
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(/* @__PURE__ */ new Date());
    }, 6e4);
    return () => clearInterval(interval);
  }, []);
  const getUrgencyLevel = (checkoutDate) => {
    const checkout = new Date(checkoutDate);
    const hoursUntil = differenceInHours(checkout, currentDateTime);
    if (hoursUntil <= 2) return { level: "critical", color: "red", label: "Critical" };
    if (hoursUntil <= 6) return { level: "high", color: "orange", label: "High" };
    if (hoursUntil <= 12) return { level: "medium", color: "yellow", label: "Medium" };
    return { level: "low", color: "blue", label: "Low" };
  };
  const getTimeRemaining = (checkoutDate) => {
    const checkout = new Date(checkoutDate);
    const hoursUntil = differenceInHours(checkout, currentDateTime);
    const minutesUntil = differenceInMinutes(checkout, currentDateTime) % 60;
    if (hoursUntil < 1) {
      return `${minutesUntil} minutes`;
    }
    return `${hoursUntil}h ${minutesUntil}m`;
  };
  const criticalCheckouts = upcomingCheckouts.filter(
    (booking) => differenceInHours(new Date(booking.checkOut), currentDateTime) <= 2
  );
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: "Real-time Monitoring" }),
      /* @__PURE__ */ jsxs(Group, { children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "blue", variant: "light", children: /* @__PURE__ */ jsx(IconClockHour2, { size: 16 }) }),
        /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
          "Last updated: ",
          format(currentDateTime, "HH:mm:ss")
        ] })
      ] })
    ] }),
    criticalCheckouts.length > 0 && /* @__PURE__ */ jsxs(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconAlertTriangle, { size: 16 }),
        title: "Critical Checkouts Alert",
        color: "red",
        children: [
          criticalCheckouts.length,
          " tenant(s) need to check out within 2 hours!"
        ]
      }
    ),
    overdueCheckouts.length > 0 && /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsxs(Group, { mb: "md", children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "red", size: "lg", children: /* @__PURE__ */ jsx(IconAlertTriangle, { size: 20 }) }),
        /* @__PURE__ */ jsxs(Title, { order: 3, c: "red", children: [
          "Overdue Checkouts (",
          overdueCheckouts.length,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ jsx(Stack, { gap: "md", children: overdueCheckouts.map((booking) => {
        const hoursOverdue = Math.abs(differenceInHours(currentDateTime, new Date(booking.checkOut)));
        const minutesOverdue = Math.abs(differenceInMinutes(currentDateTime, new Date(booking.checkOut))) % 60;
        const overdueDisplay = hoursOverdue > 0 ? `${hoursOverdue}h ${minutesOverdue}m` : `${minutesOverdue}m`;
        return /* @__PURE__ */ jsx(Card, { withBorder: true, p: "md", style: { borderLeft: "4px solid #fa5252" }, children: /* @__PURE__ */ jsxs(Group, { justify: "space-between", wrap: "nowrap", children: [
          /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsxs(Group, { gap: "lg", wrap: "nowrap", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { fw: 600, size: "sm", c: "red", children: "OVERDUE" }),
              /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
                booking.user.firstName,
                " ",
                booking.user.lastName
              ] }),
              /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.user.email })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "UNIT" }),
              /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
                "Unit ",
                booking.room.number
              ] }),
              /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.room.type.replace("_", " ") })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "EXPECTED CHECKOUT" }),
              /* @__PURE__ */ jsx(Text, { fw: 500, children: format(new Date(booking.checkOut), "MMM dd, HH:mm") }),
              /* @__PURE__ */ jsxs(Badge, { color: "red", size: "sm", children: [
                overdueDisplay,
                " overdue"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "DURATION OVERDUE" }),
              /* @__PURE__ */ jsx(Text, { fw: 700, size: "lg", c: "red", children: overdueDisplay }),
              /* @__PURE__ */ jsx(Text, { size: "xs", c: "red", children: "past due" })
            ] })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { style: { textAlign: "right" }, children: [
            /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "CONTACT" }),
            /* @__PURE__ */ jsx(Text, { size: "sm", fw: 500, children: booking.user.phone })
          ] })
        ] }) }, booking.id);
      }) })
    ] }),
    /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsxs(Group, { mb: "md", children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "orange", size: "lg", children: /* @__PURE__ */ jsx(IconClock, { size: 20 }) }),
        /* @__PURE__ */ jsx(Title, { order: 3, children: "Upcoming Checkouts (Next 48 Hours)" })
      ] }),
      upcomingCheckouts.length === 0 ? /* @__PURE__ */ jsx(Center, { p: "xl", children: /* @__PURE__ */ jsxs(Stack, { align: "center", children: [
        /* @__PURE__ */ jsx(IconInfoCircle, { size: 48, color: "gray" }),
        /* @__PURE__ */ jsx(Text, { c: "dimmed", children: "No upcoming checkouts in the next 48 hours" })
      ] }) }) : /* @__PURE__ */ jsx(Stack, { gap: "md", children: upcomingCheckouts.map((booking) => {
        const urgency = getUrgencyLevel(booking.checkOut);
        const timeRemaining = getTimeRemaining(booking.checkOut);
        return /* @__PURE__ */ jsx(
          Card,
          {
            withBorder: true,
            p: "md",
            style: {
              borderLeft: `4px solid var(--mantine-color-${urgency.color}-6)`,
              backgroundColor: urgency.level === "critical" ? "var(--mantine-color-red-0)" : void 0
            },
            children: /* @__PURE__ */ jsxs(Group, { justify: "space-between", wrap: "nowrap", children: [
              /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsxs(Group, { gap: "lg", wrap: "nowrap", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Badge, { color: urgency.color, size: "sm", mb: "xs", children: urgency.label }),
                  /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
                    booking.user.firstName,
                    " ",
                    booking.user.lastName
                  ] }),
                  /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.user.email })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "UNIT" }),
                  /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
                    "Unit ",
                    booking.room.number
                  ] }),
                  /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.room.type.replace("_", " ") })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "CHECKOUT TIME" }),
                  /* @__PURE__ */ jsx(Text, { fw: 500, children: format(new Date(booking.checkOut), "MMM dd, HH:mm") }),
                  /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
                    isToday(new Date(booking.checkOut)) && "Today",
                    isTomorrow(new Date(booking.checkOut)) && "Tomorrow"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "TIME REMAINING" }),
                  /* @__PURE__ */ jsx(Text, { fw: 700, size: "lg", c: urgency.color, children: timeRemaining }),
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: urgency.color, children: "until checkout" })
                ] })
              ] }) }),
              /* @__PURE__ */ jsxs("div", { style: { textAlign: "right" }, children: [
                /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "CONTACT" }),
                /* @__PURE__ */ jsx(Text, { size: "sm", fw: 500, children: booking.user.phone }),
                /* @__PURE__ */ jsxs("div", { style: { marginTop: "8px", textAlign: "center" }, children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "TIME LEFT" }),
                  /* @__PURE__ */ jsx(Badge, { color: urgency.color, size: "lg", variant: "filled", children: timeRemaining })
                ] })
              ] })
            ] })
          },
          booking.id
        );
      }) })
    ] }),
    /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsxs(Group, { mb: "md", children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "green", size: "lg", children: /* @__PURE__ */ jsx(IconCalendarTime, { size: 20 }) }),
        /* @__PURE__ */ jsx(Title, { order: 3, children: "Today's Check-ins" })
      ] }),
      todayCheckIns.length === 0 ? /* @__PURE__ */ jsx(Center, { p: "xl", children: /* @__PURE__ */ jsxs(Stack, { align: "center", children: [
        /* @__PURE__ */ jsx(IconInfoCircle, { size: 48, color: "gray" }),
        /* @__PURE__ */ jsx(Text, { c: "dimmed", children: "No check-ins scheduled for today" })
      ] }) }) : /* @__PURE__ */ jsx(Stack, { gap: "md", children: todayCheckIns.map((booking) => {
        const checkInTime = new Date(booking.checkIn);
        if (checkInTime.getHours() === 0 && checkInTime.getMinutes() === 0) {
          checkInTime.setHours(15, 0, 0, 0);
        }
        const hoursUntilCheckIn = differenceInHours(checkInTime, currentDateTime);
        const minutesUntilCheckIn = differenceInMinutes(checkInTime, currentDateTime) % 60;
        let timeDisplay, timeStatus, timeColor;
        if (hoursUntilCheckIn > 0) {
          timeDisplay = `${hoursUntilCheckIn}h ${Math.abs(minutesUntilCheckIn)}m`;
          timeStatus = "until check-in";
          timeColor = "blue";
        } else if (hoursUntilCheckIn === 0 && minutesUntilCheckIn > 0) {
          timeDisplay = `${minutesUntilCheckIn}m`;
          timeStatus = "until check-in";
          timeColor = "blue";
        } else {
          const hoursSince = Math.abs(hoursUntilCheckIn);
          const minutesSince = Math.abs(minutesUntilCheckIn);
          timeDisplay = hoursSince > 0 ? `${hoursSince}h ${minutesSince}m` : `${minutesSince}m`;
          timeStatus = "check-in ready";
          timeColor = "green";
        }
        return /* @__PURE__ */ jsx(
          Card,
          {
            withBorder: true,
            p: "md",
            style: {
              borderLeft: "4px solid var(--mantine-color-green-6)",
              backgroundColor: "var(--mantine-color-green-0)"
            },
            children: /* @__PURE__ */ jsxs(Group, { justify: "space-between", wrap: "nowrap", children: [
              /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsxs(Group, { gap: "lg", wrap: "nowrap", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(
                    Badge,
                    {
                      color: booking.status === "CHECKED_IN" ? "blue" : "green",
                      size: "sm",
                      mb: "xs",
                      children: booking.status === "CHECKED_IN" ? "Checked In" : "Confirmed"
                    }
                  ),
                  /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
                    booking.user.firstName,
                    " ",
                    booking.user.lastName
                  ] }),
                  /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.user.email })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "UNIT" }),
                  /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
                    "Unit ",
                    booking.room.number
                  ] }),
                  /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.room.type.replace("_", " ") })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "CHECK-IN" }),
                  /* @__PURE__ */ jsx(Text, { fw: 500, children: (() => {
                    const checkInDate = new Date(booking.checkIn);
                    const timeStr = format(checkInDate, "HH:mm");
                    if (timeStr === "00:00") {
                      return "3:00 PM";
                    }
                    return format(checkInDate, "h:mm a");
                  })() }),
                  /* @__PURE__ */ jsx(Text, { size: "sm", c: "green", children: isToday(new Date(booking.checkIn)) ? "Today" : format(new Date(booking.checkIn), "MMM dd") })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "TIME STATUS" }),
                  /* @__PURE__ */ jsx(Text, { fw: 700, size: "lg", c: timeColor, children: timeDisplay }),
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: timeColor, children: timeStatus })
                ] })
              ] }) }),
              /* @__PURE__ */ jsxs("div", { style: { textAlign: "right" }, children: [
                /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: "CONTACT" }),
                /* @__PURE__ */ jsx(Text, { size: "sm", fw: 500, children: booking.user.phone }),
                /* @__PURE__ */ jsxs("div", { style: { marginTop: "8px", textAlign: "center" }, children: [
                  /* @__PURE__ */ jsx(Badge, { color: timeColor, size: "lg", variant: "filled", children: timeDisplay }),
                  /* @__PURE__ */ jsx(Text, { size: "xs", c: timeColor, mt: 2, children: timeStatus })
                ] })
              ] })
            ] })
          },
          booking.id
        );
      }) })
    ] }),
    /* @__PURE__ */ jsxs(Grid, { children: [
      /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, md: 3 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Group, { children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "red", size: "lg", children: /* @__PURE__ */ jsx(IconAlertTriangle, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, children: overdueCheckouts.length }),
          /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Overdue" })
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, md: 3 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Group, { children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "orange", size: "lg", children: /* @__PURE__ */ jsx(IconClock, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, children: criticalCheckouts.length }),
          /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Critical (2h)" })
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, md: 3 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Group, { children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "blue", size: "lg", children: /* @__PURE__ */ jsx(IconBed, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, children: upcomingCheckouts.length }),
          /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Upcoming (48h)" })
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, md: 3 }, children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Group, { children: [
        /* @__PURE__ */ jsx(ThemeIcon, { color: "green", size: "lg", children: /* @__PURE__ */ jsx(IconUser, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, children: todayCheckIns.length }),
          /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Today's Check-ins" })
        ] })
      ] }) }) })
    ] })
  ] }) });
}
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Monitoring,
  loader: loader$b,
  meta: meta$9
}, Symbol.toStringTag, { value: "Module" }));
const meta$8 = () => {
  return [
    { title: "Analytics - Apartment Management" },
    { name: "description", content: "Apartment analytics and reports" }
  ];
};
async function loader$a({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const currentDate = /* @__PURE__ */ new Date();
  const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const [
    // Current month stats
    currentMonthBookings,
    currentMonthRevenue,
    currentMonthGuests,
    // Previous month stats for comparison
    previousMonthBookings,
    previousMonthRevenue,
    // Overall stats
    totalRooms,
    occupiedRooms,
    totalGuests,
    averageRating,
    // Room type distribution
    roomTypeStats,
    // Recent bookings
    recentBookings,
    // Payment method distribution
    paymentStats
  ] = await Promise.all([
    // Current month
    db.booking.count({
      where: {
        createdAt: { gte: currentMonth, lt: nextMonth },
        status: { not: "CANCELLED" }
      }
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: currentMonth, lt: nextMonth },
        status: "COMPLETED"
      }
    }),
    db.user.count({
      where: {
        createdAt: { gte: currentMonth, lt: nextMonth },
        role: "GUEST"
      }
    }),
    // Previous month
    db.booking.count({
      where: {
        createdAt: { gte: previousMonth, lt: currentMonth },
        status: { not: "CANCELLED" }
      }
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: previousMonth, lt: currentMonth },
        status: "COMPLETED"
      }
    }),
    // Overall
    db.room.count(),
    db.room.count({ where: { status: "OCCUPIED" } }),
    db.user.count({ where: { role: "GUEST" } }),
    db.review.aggregate({ _avg: { rating: true } }),
    // Room type stats
    db.room.groupBy({
      by: ["type"],
      _count: { type: true }
    }),
    // Recent bookings
    db.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true } },
        room: { select: { number: true } }
      }
    }),
    // Payment methods
    db.payment.groupBy({
      by: ["method"],
      _count: { method: true },
      _sum: { amount: true },
      where: { status: "COMPLETED" }
    })
  ]);
  const bookingsChange = previousMonthBookings > 0 ? (currentMonthBookings - previousMonthBookings) / previousMonthBookings * 100 : 0;
  const revenueChange = (previousMonthRevenue._sum.amount || 0) > 0 ? ((currentMonthRevenue._sum.amount || 0) - (previousMonthRevenue._sum.amount || 0)) / (previousMonthRevenue._sum.amount || 1) * 100 : 0;
  const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms * 100 : 0;
  return json({
    user,
    stats: {
      currentMonth: {
        bookings: currentMonthBookings,
        revenue: currentMonthRevenue._sum.amount || 0,
        guests: currentMonthGuests
      },
      changes: {
        bookings: bookingsChange,
        revenue: revenueChange
      },
      overall: {
        totalRooms,
        occupiedRooms,
        occupancyRate,
        totalGuests,
        averageRating: averageRating._avg.rating || 0
      },
      roomTypes: roomTypeStats,
      recentBookings,
      paymentMethods: paymentStats
    }
  });
}
function Analytics() {
  const { user, stats } = useLoaderData();
  const formatChange = (change) => {
    const isPositive = change >= 0;
    return {
      value: Math.abs(change).toFixed(1),
      color: isPositive ? "green" : "red",
      icon: isPositive ? IconTrendingUp : IconTrendingDown
    };
  };
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsx(Title, { order: 2, children: "Analytics & Reports" }),
    /* @__PURE__ */ jsxs(SimpleGrid, { cols: { base: 1, sm: 2, lg: 4 }, children: [
      /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", children: [
        /* @__PURE__ */ jsxs(Group, { justify: "space-between", mb: "md", children: [
          /* @__PURE__ */ jsx(ThemeIcon, { size: "xl", variant: "light", color: "blue", children: /* @__PURE__ */ jsx(IconCalendar, { size: 24 }) }),
          /* @__PURE__ */ jsx("div", { style: { textAlign: "right" }, children: (() => {
            const change = formatChange(stats.changes.bookings);
            return /* @__PURE__ */ jsxs(Group, { gap: "xs", justify: "flex-end", children: [
              /* @__PURE__ */ jsx(change.icon, { size: 16, color: change.color }),
              /* @__PURE__ */ jsxs(Text, { size: "sm", c: change.color, children: [
                change.value,
                "%"
              ] })
            ] });
          })() })
        ] }),
        /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, mb: "xs", children: stats.currentMonth.bookings }),
        /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Bookings this month" })
      ] }),
      /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", children: [
        /* @__PURE__ */ jsxs(Group, { justify: "space-between", mb: "md", children: [
          /* @__PURE__ */ jsx(ThemeIcon, { size: "xl", variant: "light", color: "green", children: /* @__PURE__ */ jsx(IconCurrencyDollar, { size: 24 }) }),
          /* @__PURE__ */ jsx("div", { style: { textAlign: "right" }, children: (() => {
            const change = formatChange(stats.changes.revenue);
            return /* @__PURE__ */ jsxs(Group, { gap: "xs", justify: "flex-end", children: [
              /* @__PURE__ */ jsx(change.icon, { size: 16, color: change.color }),
              /* @__PURE__ */ jsxs(Text, { size: "sm", c: change.color, children: [
                change.value,
                "%"
              ] })
            ] });
          })() })
        ] }),
        /* @__PURE__ */ jsxs(Text, { size: "xl", fw: 700, mb: "xs", children: [
          "$",
          stats.currentMonth.revenue.toLocaleString()
        ] }),
        /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Revenue this month" })
      ] }),
      /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", children: [
        /* @__PURE__ */ jsx(Group, { justify: "space-between", mb: "md", children: /* @__PURE__ */ jsx(ThemeIcon, { size: "xl", variant: "light", color: "violet", children: /* @__PURE__ */ jsx(IconBed, { size: 24 }) }) }),
        /* @__PURE__ */ jsxs(Text, { size: "xl", fw: 700, mb: "xs", children: [
          stats.overall.occupancyRate.toFixed(1),
          "%"
        ] }),
        /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Occupancy rate" }),
        /* @__PURE__ */ jsx(
          Progress,
          {
            value: stats.overall.occupancyRate,
            size: "sm",
            mt: "xs",
            color: stats.overall.occupancyRate > 80 ? "red" : stats.overall.occupancyRate > 60 ? "yellow" : "green"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", children: [
        /* @__PURE__ */ jsx(Group, { justify: "space-between", mb: "md", children: /* @__PURE__ */ jsx(ThemeIcon, { size: "xl", variant: "light", color: "orange", children: /* @__PURE__ */ jsx(IconUsers, { size: 24 }) }) }),
        /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, mb: "xs", children: stats.overall.totalGuests }),
        /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "Total guests" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", children: [
      /* @__PURE__ */ jsx(Title, { order: 4, mb: "md", children: "Room Type Distribution" }),
      /* @__PURE__ */ jsx(SimpleGrid, { cols: { base: 1, sm: 2, lg: 4 }, children: stats.roomTypes.map((roomType) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(Text, { fw: 500, mb: "xs", children: roomType.type.replace("_", " ") }),
        /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, c: "blue", children: roomType._count.type }),
        /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "rooms" })
      ] }, roomType.type)) })
    ] }),
    /* @__PURE__ */ jsxs(SimpleGrid, { cols: { base: 1, lg: 2 }, children: [
      /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", h: "100%", children: [
        /* @__PURE__ */ jsx(Title, { order: 4, mb: "md", children: "Recent Bookings" }),
        /* @__PURE__ */ jsx(Stack, { gap: "sm", children: stats.recentBookings.map((booking) => /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
              booking.user.firstName,
              " ",
              booking.user.lastName
            ] }),
            /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
              "Room ",
              booking.room.number
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { textAlign: "right" }, children: [
            /* @__PURE__ */ jsxs(Badge, { size: "sm", color: "green", children: [
              "$",
              booking.totalAmount
            ] }),
            /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: booking.status })
          ] })
        ] }, booking.id)) })
      ] }),
      /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", h: "100%", children: [
        /* @__PURE__ */ jsx(Title, { order: 4, mb: "md", children: "Payment Methods" }),
        /* @__PURE__ */ jsx(Stack, { gap: "sm", children: stats.paymentMethods.map((payment) => /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { fw: 500, children: payment.method.replace("_", " ") }),
            /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
              payment._count.method,
              " transactions"
            ] })
          ] }),
          /* @__PURE__ */ jsxs(Text, { fw: 700, c: "green", children: [
            "$",
            (payment._sum.amount || 0).toLocaleString()
          ] })
        ] }, payment.method)) })
      ] })
    ] })
  ] }) });
}
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Analytics,
  loader: loader$a,
  meta: meta$8
}, Symbol.toStringTag, { value: "Module" }));
const resend = new Resend(process.env.RESEND_API_KEY);
const emailService = {
  async sendWelcomeEmail({ firstName, lastName, email, temporaryPassword }) {
    try {
      const { data, error } = await resend.emails.send({
        from: "Platinum Apartment <noreply@platinum-apartment.com>",
        to: [email],
        subject: "Welcome to Platinum Apartment!",
        html: generateWelcomeEmailHTML({ firstName, lastName, email, temporaryPassword }),
        text: generateWelcomeEmailText({ firstName, lastName, email, temporaryPassword })
      });
      if (error) {
        console.error("Failed to send welcome email:", error);
        throw new Error(`Failed to send welcome email: ${error.message}`);
      }
      console.log("Welcome email sent successfully:", data);
      return { success: true, data };
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw error;
    }
  },
  async sendBookingConfirmation({
    firstName,
    lastName,
    email,
    roomNumber,
    checkIn,
    checkOut,
    totalAmount,
    bookingId
  }) {
    try {
      const { data, error } = await resend.emails.send({
        from: "Platinum Apartment <noreply@platinum-apartment.com>",
        to: [email],
        subject: "Booking Confirmation - Platinum Apartment",
        html: generateBookingConfirmationHTML({
          firstName,
          lastName,
          email,
          roomNumber,
          checkIn,
          checkOut,
          totalAmount,
          bookingId
        }),
        text: generateBookingConfirmationText({
          firstName,
          lastName,
          email,
          roomNumber,
          checkIn,
          checkOut,
          totalAmount,
          bookingId
        })
      });
      if (error) {
        console.error("Failed to send booking confirmation:", error);
        throw new Error(`Failed to send booking confirmation: ${error.message}`);
      }
      console.log("Booking confirmation sent successfully:", data);
      return { success: true, data };
    } catch (error) {
      console.error("Error sending booking confirmation:", error);
      throw error;
    }
  }
};
function generateWelcomeEmailHTML({ firstName, lastName, email, temporaryPassword }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Platinum Apartment</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .credentials {
          background: #e3f2fd;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #2196f3;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏨 Welcome to Platinum Apartment!</h1>
      </div>
      <div class="content">
        <h2>Hello ${firstName} ${lastName}!</h2>
        
        <p>We're thrilled to welcome you to Platinum Apartment, where luxury meets comfort. Your account has been successfully created and you're now part of our exclusive community.</p>
        
        <div class="credentials">
          <h3>Your Account Details:</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
          <p><em>⚠️ Please change your password after your first login for security purposes.</em></p>
        </div>
        
        <h3>What's Next?</h3>
        <ul>
          <li>Log in to your account using the credentials above</li>
          <li>Update your profile and change your password</li>
          <li>Explore our premium amenities and services</li>
          <li>Make your first booking and experience luxury living</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${process.env.APP_URL || "http://localhost:5173"}/login" class="button">
            Login to Your Account
          </a>
        </div>
        
        <h3>Our Premium Amenities:</h3>
        <ul>
          <li>🛏️ Luxury furnished apartments</li>
          <li>📶 High-speed WiFi throughout the complex</li>
          <li>🚗 Complimentary parking for residents</li>
          <li>🏊‍♂️ Outdoor pool with city views</li>
          <li>🍽️ Fine dining restaurant</li>
          <li>💆‍♀️ Spa & wellness center</li>
        </ul>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our 24/7 support team.</p>
        
        <p>Welcome aboard!</p>
        <p><strong>The Platinum Apartment Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2025 Platinum Apartment. All rights reserved.</p>
        <p>This email was sent to ${email}. If you received this in error, please contact us.</p>
      </div>
    </body>
    </html>
  `;
}
function generateWelcomeEmailText({ firstName, lastName, email, temporaryPassword }) {
  return `
Welcome to Platinum Apartment!

Hello ${firstName} ${lastName}!

We're thrilled to welcome you to Platinum Apartment, where luxury meets comfort. Your account has been successfully created and you're now part of our exclusive community.

Your Account Details:
- Email: ${email}
- Temporary Password: ${temporaryPassword}

⚠️ Please change your password after your first login for security purposes.

What's Next?
1. Log in to your account using the credentials above
2. Update your profile and change your password
3. Explore our premium amenities and services
4. Make your first booking and experience luxury living

Login URL: ${process.env.APP_URL || "http://localhost:5173"}/login

Our Premium Amenities:
- Luxury furnished apartments
- High-speed WiFi throughout the complex
- Complimentary parking for residents
- Outdoor pool with city views
- Fine dining restaurant
- Spa & wellness center

If you have any questions or need assistance, please don't hesitate to contact our 24/7 support team.

Welcome aboard!
The Platinum Apartment Team

© 2025 Platinum Apartment. All rights reserved.
This email was sent to ${email}. If you received this in error, please contact us.
  `;
}
function generateBookingConfirmationHTML({
  firstName,
  lastName,
  email,
  roomNumber,
  checkIn,
  checkOut,
  totalAmount,
  bookingId
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - Platinum Apartment</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .booking-details {
          background: #e8f5e8;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #4caf50;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          padding: 5px 0;
          border-bottom: 1px solid #ddd;
        }
        .total-amount {
          background: #fff3cd;
          padding: 15px;
          border-radius: 5px;
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Booking Confirmed!</h1>
      </div>
      <div class="content">
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>Great news! Your booking at Platinum Apartment has been confirmed. We're excited to host you and ensure you have a memorable stay.</p>
        
        <div class="booking-details">
          <h3>Booking Details:</h3>
          <div class="detail-row">
            <span><strong>Booking ID:</strong></span>
            <span>${bookingId}</span>
          </div>
          <div class="detail-row">
            <span><strong>Guest:</strong></span>
            <span>${firstName} ${lastName}</span>
          </div>
          <div class="detail-row">
            <span><strong>Unit:</strong></span>
            <span>Unit ${roomNumber}</span>
          </div>
          <div class="detail-row">
            <span><strong>Check-in:</strong></span>
            <span>${checkIn}</span>
          </div>
          <div class="detail-row">
            <span><strong>Check-out:</strong></span>
            <span>${checkOut}</span>
          </div>
          <div class="detail-row">
            <span><strong>Email:</strong></span>
            <span>${email}</span>
          </div>
        </div>
        
        <div class="total-amount">
          Total Amount: $${totalAmount.toLocaleString()}
        </div>
        
        <h3>What to Expect:</h3>
        <ul>
          <li>Check-in starts at 3:00 PM</li>
          <li>Check-out is at 11:00 AM</li>
          <li>24/7 concierge service available</li>
          <li>Complimentary WiFi and parking</li>
          <li>Access to all apartment amenities</li>
        </ul>
        
        <h3>Need to Make Changes?</h3>
        <p>If you need to modify or cancel your booking, please contact us at least 24 hours before your check-in date.</p>
        
        <p>We look forward to welcoming you to Platinum Apartment!</p>
        
        <p><strong>The Platinum Apartment Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2025 Platinum Apartment. All rights reserved.</p>
        <p>Questions? Contact us at support@platinum-apartment.com</p>
      </div>
    </body>
    </html>
  `;
}
function generateBookingConfirmationText({
  firstName,
  lastName,
  email,
  roomNumber,
  checkIn,
  checkOut,
  totalAmount,
  bookingId
}) {
  return `
Booking Confirmed - Platinum Apartment

Dear ${firstName} ${lastName},

Great news! Your booking at Platinum Apartment has been confirmed. We're excited to host you and ensure you have a memorable stay.

Booking Details:
- Booking ID: ${bookingId}
- Guest: ${firstName} ${lastName}
- Unit: Unit ${roomNumber}
- Check-in: ${checkIn}
- Check-out: ${checkOut}
- Email: ${email}
- Total Amount: $${totalAmount.toLocaleString()}

What to Expect:
- Check-in starts at 3:00 PM
- Check-out is at 11:00 AM
- 24/7 concierge service available
- Complimentary WiFi and parking
- Access to all apartment amenities

Need to Make Changes?
If you need to modify or cancel your booking, please contact us at least 24 hours before your check-in date.

We look forward to welcoming you to Platinum Apartment!

The Platinum Apartment Team

© 2025 Platinum Apartment. All rights reserved.
Questions? Contact us at support@platinum-apartment.com
  `;
}
const meta$7 = () => {
  return [
    { title: "Bookings - Apartment Management" },
    { name: "description", content: "Manage apartment bookings" }
  ];
};
async function loader$9({ request }) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const bookingFilter = (user == null ? void 0 : user.role) === "GUEST" ? { userId } : {};
  const bookings = await db.booking.findMany({
    where: bookingFilter,
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true }
      },
      room: {
        select: { number: true, type: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const availableRooms = await db.room.findMany({
    where: { status: "AVAILABLE" },
    select: { id: true, number: true, type: true, pricePerNight: true }
  });
  const guests = await db.user.findMany({
    where: { role: "GUEST" },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  return json({ user, bookings, availableRooms, guests });
}
async function action$6({ request }) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  try {
    if (intent === "create") {
      const userId = formData.get("userId");
      const roomId = formData.get("roomId");
      const checkIn = new Date(formData.get("checkIn"));
      const checkOut = new Date(formData.get("checkOut"));
      const guests = parseInt(formData.get("guests"));
      const specialRequests = formData.get("specialRequests");
      if (!userId || !roomId || !checkIn || !checkOut || !guests) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }
      if (checkIn >= checkOut) {
        return json({ error: "Check-out date must be after check-in date" }, { status: 400 });
      }
      const room = await db.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return json({ error: "Room not found" }, { status: 400 });
      }
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1e3 * 60 * 60 * 24));
      const totalAmount = nights * room.pricePerNight;
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return json({ error: "User not found" }, { status: 400 });
      }
      const newBooking = await db.booking.create({
        data: {
          userId,
          roomId,
          checkIn,
          checkOut,
          guests,
          totalAmount,
          specialRequests: specialRequests || null,
          status: "CONFIRMED"
        }
      });
      try {
        await emailService.sendBookingConfirmation({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roomNumber: room.number,
          checkIn: checkIn.toLocaleDateString(),
          checkOut: checkOut.toLocaleDateString(),
          totalAmount,
          bookingId: newBooking.id
        });
        console.log(`Booking confirmation email sent to ${user.email}`);
      } catch (emailError) {
        console.error(`Failed to send booking confirmation to ${user.email}:`, emailError);
      }
      return json({ success: "Booking created successfully and confirmation email sent!" });
    }
    if (intent === "update-status") {
      const bookingId = formData.get("bookingId");
      const status = formData.get("status");
      await db.booking.update({
        where: { id: bookingId },
        data: { status }
      });
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true }
      });
      if (booking) {
        let roomStatus = "AVAILABLE";
        if (status === "CHECKED_IN") {
          roomStatus = "OCCUPIED";
        }
        await db.room.update({
          where: { id: booking.roomId },
          data: { status: roomStatus }
        });
      }
      return json({ success: "Booking status updated successfully" });
    }
    if (intent === "delete") {
      const bookingId = formData.get("bookingId");
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { room: true }
      });
      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }
      if (!["PENDING", "CANCELLED"].includes(booking.status)) {
        return json({ error: "Only pending or cancelled bookings can be deleted" }, { status: 400 });
      }
      await db.booking.delete({
        where: { id: bookingId }
      });
      if (booking.room.status === "OCCUPIED") {
        await db.room.update({
          where: { id: booking.roomId },
          data: { status: "AVAILABLE" }
        });
      }
      return json({ success: "Booking deleted successfully" });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Booking action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Bookings() {
  const { user, bookings, availableRooms, guests } = useLoaderData();
  const actionData = useActionData();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredBookings = useMemo(() => {
    let filtered = bookings.filter((booking) => {
      const matchesSearch = booking.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || booking.user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) || booking.user.email.toLowerCase().includes(searchQuery.toLowerCase()) || booking.room.number.toString().includes(searchQuery.toLowerCase()) || booking.room.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return filtered;
  }, [bookings, searchQuery, statusFilter]);
  const getStatusColor = (status) => {
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
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: (user == null ? void 0 : user.role) === "GUEST" ? "My Bookings" : "Bookings Management" }),
      ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsx(Button, { leftSection: /* @__PURE__ */ jsx(IconPlus, { size: 16 }), onClick: open, children: "New Booking" })
    ] }),
    actionData && "error" in actionData && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        children: actionData.error
      }
    ),
    actionData && "success" in actionData && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Success",
        color: "green",
        children: actionData.success
      }
    ),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsx(
        TextInput,
        {
          placeholder: "Search bookings...",
          leftSection: /* @__PURE__ */ jsx(IconSearch, { size: 16 }),
          value: searchQuery,
          onChange: (event) => setSearchQuery(event.currentTarget.value),
          style: { flexGrow: 1 }
        }
      ),
      /* @__PURE__ */ jsx(
        Select,
        {
          placeholder: "Filter by status",
          value: statusFilter,
          onChange: (value) => setStatusFilter(value || "all"),
          data: [
            { value: "all", label: "All Statuses" },
            { value: "PENDING", label: "Pending" },
            { value: "CONFIRMED", label: "Confirmed" },
            { value: "CHECKED_IN", label: "Checked In" },
            { value: "CHECKED_OUT", label: "Checked Out" },
            { value: "CANCELLED", label: "Cancelled" }
          ],
          style: { minWidth: 150 }
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsx(Group, { justify: "space-between", mb: "md", children: /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
        "Showing ",
        filteredBookings.length,
        " of ",
        bookings.length,
        " bookings"
      ] }) }),
      /* @__PURE__ */ jsxs(Table, { striped: true, highlightOnHover: true, children: [
        /* @__PURE__ */ jsx(Table.Thead, { children: /* @__PURE__ */ jsxs(Table.Tr, { children: [
          ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsx(Table.Th, { children: "Guest" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Room" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Check-in" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Check-out" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Guests" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Total" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Status" }),
          ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsx(Table.Th, { children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx(Table.Tbody, { children: filteredBookings.length === 0 ? /* @__PURE__ */ jsx(Table.Tr, { children: /* @__PURE__ */ jsx(Table.Td, { colSpan: 8, style: { textAlign: "center", padding: "2rem" }, children: /* @__PURE__ */ jsxs(Stack, { align: "center", gap: "sm", children: [
          /* @__PURE__ */ jsx(IconInfoCircle, { size: 48, color: "gray" }),
          /* @__PURE__ */ jsx(Text, { c: "dimmed", children: searchQuery || statusFilter !== "all" ? "No bookings found matching your criteria" : "No bookings available" })
        ] }) }) }) : filteredBookings.map((booking) => /* @__PURE__ */ jsxs(Table.Tr, { children: [
          ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
              booking.user.firstName,
              " ",
              booking.user.lastName
            ] }),
            /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.user.email })
          ] }) }),
          /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
              "Room ",
              booking.room.number
            ] }),
            /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: booking.room.type.replace("_", " ") })
          ] }) }),
          /* @__PURE__ */ jsx(Table.Td, { children: format(new Date(booking.checkIn), "MMM dd, yyyy") }),
          /* @__PURE__ */ jsx(Table.Td, { children: format(new Date(booking.checkOut), "MMM dd, yyyy") }),
          /* @__PURE__ */ jsx(Table.Td, { children: booking.guests }),
          /* @__PURE__ */ jsxs(Table.Td, { children: [
            "$",
            booking.totalAmount
          ] }),
          /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Badge, { color: getStatusColor(booking.status), size: "sm", children: booking.status.replace("_", " ") }) }),
          ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs(Group, { gap: "xs", children: [
            /* @__PURE__ */ jsxs(Form, { method: "post", style: { display: "inline" }, children: [
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "update-status" }),
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "bookingId", value: booking.id }),
              /* @__PURE__ */ jsx(
                Select,
                {
                  name: "status",
                  size: "xs",
                  data: [
                    { value: "PENDING", label: "Pending" },
                    { value: "CONFIRMED", label: "Confirmed" },
                    { value: "CHECKED_IN", label: "Checked In" },
                    { value: "CHECKED_OUT", label: "Checked Out" },
                    { value: "CANCELLED", label: "Cancelled" }
                  ],
                  defaultValue: booking.status,
                  onChange: (value) => {
                    if (value) {
                      const form = new FormData();
                      form.append("intent", "update-status");
                      form.append("bookingId", booking.id);
                      form.append("status", value);
                      fetch("/dashboard/bookings", {
                        method: "POST",
                        body: form
                      }).then(() => window.location.reload());
                    }
                  }
                }
              )
            ] }),
            ["PENDING", "CANCELLED"].includes(booking.status) && /* @__PURE__ */ jsxs(Form, { method: "post", style: { display: "inline" }, children: [
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "delete" }),
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "bookingId", value: booking.id }),
              /* @__PURE__ */ jsx(
                ActionIcon,
                {
                  variant: "subtle",
                  color: "red",
                  type: "submit",
                  size: "sm",
                  onClick: (e) => {
                    if (!confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
                      e.preventDefault();
                    }
                  },
                  children: /* @__PURE__ */ jsx(IconTrash, { size: 14 })
                }
              )
            ] })
          ] }) })
        ] }, booking.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Modal, { opened, onClose: close, title: "Create New Booking", size: "lg", children: /* @__PURE__ */ jsxs(Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "create" }),
      /* @__PURE__ */ jsxs(Stack, { children: [
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Guest",
            placeholder: "Select guest",
            name: "userId",
            data: guests.map((guest) => ({
              value: guest.id,
              label: `${guest.firstName} ${guest.lastName} (${guest.email})`
            })),
            required: true,
            searchable: true
          }
        ),
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Room",
            placeholder: "Select room",
            name: "roomId",
            data: availableRooms.map((room) => ({
              value: room.id,
              label: `Room ${room.number} - ${room.type} ($${room.pricePerNight}/night)`
            })),
            required: true,
            searchable: true
          }
        ),
        /* @__PURE__ */ jsxs(Group, { grow: true, children: [
          /* @__PURE__ */ jsx(
            DateInput,
            {
              label: "Check-in Date",
              placeholder: "Select date",
              name: "checkIn",
              required: true,
              minDate: /* @__PURE__ */ new Date()
            }
          ),
          /* @__PURE__ */ jsx(
            DateInput,
            {
              label: "Check-out Date",
              placeholder: "Select date",
              name: "checkOut",
              required: true,
              minDate: /* @__PURE__ */ new Date()
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          NumberInput,
          {
            label: "Number of Guests",
            placeholder: "2",
            name: "guests",
            min: 1,
            required: true
          }
        ),
        /* @__PURE__ */ jsx(
          Textarea,
          {
            label: "Special Requests",
            placeholder: "Any special requests...",
            name: "specialRequests",
            rows: 3
          }
        ),
        /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", onClick: close, children: "Create Booking" })
        ] })
      ] })
    ] }) })
  ] }) });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  default: Bookings,
  loader: loader$9,
  meta: meta$7
}, Symbol.toStringTag, { value: "Module" }));
const meta$6 = () => {
  return [
    { title: "Payments - Apartment Management" },
    { name: "description", content: "Manage apartment payments" }
  ];
};
async function loader$8({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const payments = await db.payment.findMany({
    include: {
      booking: {
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          },
          room: {
            select: { number: true }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const unpaidBookings = await db.booking.findMany({
    where: {
      payment: null,
      status: { not: "CANCELLED" }
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true }
      },
      room: {
        select: { number: true }
      }
    }
  });
  return json({ user, payments, unpaidBookings });
}
async function action$5({ request }) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  try {
    if (intent === "create") {
      const bookingId = formData.get("bookingId");
      const method = formData.get("method");
      const transactionId = formData.get("transactionId");
      if (!bookingId || !method) {
        return json({ error: "Booking and payment method are required" }, { status: 400 });
      }
      const booking = await db.booking.findUnique({
        where: { id: bookingId }
      });
      if (!booking) {
        return json({ error: "Booking not found" }, { status: 400 });
      }
      await db.payment.create({
        data: {
          bookingId,
          amount: booking.totalAmount,
          method,
          status: "COMPLETED",
          transactionId: transactionId || null,
          paidAt: /* @__PURE__ */ new Date()
        }
      });
      return json({ success: "Payment recorded successfully" });
    }
    if (intent === "update-status") {
      const paymentId = formData.get("paymentId");
      const status = formData.get("status");
      await db.payment.update({
        where: { id: paymentId },
        data: {
          status,
          paidAt: status === "COMPLETED" ? /* @__PURE__ */ new Date() : null
        }
      });
      return json({ success: "Payment status updated successfully" });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Payment action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Payments() {
  const { user, payments, unpaidBookings } = useLoaderData();
  const actionData = useActionData();
  const [opened, { open, close }] = useDisclosure(false);
  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "green";
      case "PENDING":
        return "yellow";
      case "FAILED":
        return "red";
      case "REFUNDED":
        return "gray";
      default:
        return "gray";
    }
  };
  const getMethodColor = (method) => {
    switch (method) {
      case "CASH":
        return "green";
      case "CREDIT_CARD":
        return "blue";
      case "DEBIT_CARD":
        return "cyan";
      case "ONLINE":
        return "violet";
      case "BANK_TRANSFER":
        return "orange";
      default:
        return "gray";
    }
  };
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: "Payments Management" }),
      ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && unpaidBookings.length > 0 && /* @__PURE__ */ jsx(Button, { leftSection: /* @__PURE__ */ jsx(IconPlus, { size: 16 }), onClick: open, children: "Record Payment" })
    ] }),
    (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        children: actionData.error
      }
    ),
    (actionData == null ? void 0 : actionData.success) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Success",
        color: "green",
        children: actionData.success
      }
    ),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Table, { striped: true, highlightOnHover: true, children: [
      /* @__PURE__ */ jsx(Table.Thead, { children: /* @__PURE__ */ jsxs(Table.Tr, { children: [
        /* @__PURE__ */ jsx(Table.Th, { children: "Guest" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Room" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Amount" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Method" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Status" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Transaction ID" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Paid Date" }),
        /* @__PURE__ */ jsx(Table.Th, { children: "Actions" })
      ] }) }),
      /* @__PURE__ */ jsx(Table.Tbody, { children: payments.map((payment) => /* @__PURE__ */ jsxs(Table.Tr, { children: [
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
            payment.booking.user.firstName,
            " ",
            payment.booking.user.lastName
          ] }),
          /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: payment.booking.user.email })
        ] }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
          "Room ",
          payment.booking.room.number
        ] }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
          "$",
          payment.amount
        ] }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Badge, { color: getMethodColor(payment.method), size: "sm", children: payment.method.replace("_", " ") }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Badge, { color: getStatusColor(payment.status), size: "sm", children: payment.status }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: payment.transactionId || "N/A" }) }),
        /* @__PURE__ */ jsx(Table.Td, { children: payment.paidAt ? format(new Date(payment.paidAt), "MMM dd, yyyy") : "N/A" }),
        /* @__PURE__ */ jsx(Table.Td, { children: ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER") && /* @__PURE__ */ jsxs(Form, { method: "post", style: { display: "inline" }, children: [
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "update-status" }),
          /* @__PURE__ */ jsx("input", { type: "hidden", name: "paymentId", value: payment.id }),
          /* @__PURE__ */ jsx(
            Select,
            {
              name: "status",
              size: "xs",
              data: [
                { value: "PENDING", label: "Pending" },
                { value: "COMPLETED", label: "Completed" },
                { value: "FAILED", label: "Failed" },
                { value: "REFUNDED", label: "Refunded" }
              ],
              defaultValue: payment.status,
              onChange: (value) => {
                if (value) {
                  const form = new FormData();
                  form.append("intent", "update-status");
                  form.append("paymentId", payment.id);
                  form.append("status", value);
                  fetch("/dashboard/payments", {
                    method: "POST",
                    body: form
                  }).then(() => window.location.reload());
                }
              }
            }
          )
        ] }) })
      ] }, payment.id)) })
    ] }) }),
    /* @__PURE__ */ jsx(Modal, { opened, onClose: close, title: "Record Payment", size: "lg", children: /* @__PURE__ */ jsxs(Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "create" }),
      /* @__PURE__ */ jsxs(Stack, { children: [
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Booking",
            placeholder: "Select booking",
            name: "bookingId",
            data: unpaidBookings.map((booking) => ({
              value: booking.id,
              label: `${booking.user.firstName} ${booking.user.lastName} - Room ${booking.room.number} ($${booking.totalAmount})`
            })),
            required: true,
            searchable: true
          }
        ),
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Payment Method",
            placeholder: "Select method",
            name: "method",
            data: [
              { value: "CASH", label: "Cash" },
              { value: "CREDIT_CARD", label: "Credit Card" },
              { value: "DEBIT_CARD", label: "Debit Card" },
              { value: "ONLINE", label: "Online Payment" },
              { value: "BANK_TRANSFER", label: "Bank Transfer" }
            ],
            required: true
          }
        ),
        /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", onClick: close, children: "Record Payment" })
        ] })
      ] })
    ] }) })
  ] }) });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: Payments,
  loader: loader$8,
  meta: meta$6
}, Symbol.toStringTag, { value: "Module" }));
const meta$5 = () => {
  return [
    { title: "Guests - Apartment Management" },
    { name: "description", content: "Manage apartment guests" }
  ];
};
async function loader$7({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const guests = await db.user.findMany({
    where: { role: "GUEST" },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 3
        // Show only last 3 bookings
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return json({ user, guests });
}
async function action$4({ request }) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  try {
    if (intent === "create") {
      const email = formData.get("email");
      const password = formData.get("password");
      const firstName = formData.get("firstName");
      const lastName = formData.get("lastName");
      const phone = formData.get("phone");
      const address = formData.get("address");
      if (!email || !password || !firstName || !lastName) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        return json({ error: "A user with this email already exists" }, { status: 400 });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone: phone || null,
          address: address || null,
          role: "GUEST"
        }
      });
      try {
        await emailService.sendWelcomeEmail({
          firstName,
          lastName,
          email,
          temporaryPassword: password
          // Send the original password in the email
        });
        console.log(`Welcome email sent to ${email}`);
      } catch (emailError) {
        console.error(`Failed to send welcome email to ${email}:`, emailError);
      }
      return json({ success: "Guest created successfully and welcome email sent!" });
    }
    if (intent === "update") {
      const guestId = formData.get("guestId");
      const firstName = formData.get("firstName");
      const lastName = formData.get("lastName");
      const phone = formData.get("phone");
      const address = formData.get("address");
      if (!firstName || !lastName) {
        return json({ error: "First name and last name are required" }, { status: 400 });
      }
      await db.user.update({
        where: { id: guestId },
        data: {
          firstName,
          lastName,
          phone: phone || null,
          address: address || null
        }
      });
      return json({ success: "Guest updated successfully" });
    }
    if (intent === "delete") {
      const guestId = formData.get("guestId");
      const activeBookings = await db.booking.findMany({
        where: {
          userId: guestId,
          status: { in: ["CONFIRMED", "CHECKED_IN"] }
        }
      });
      if (activeBookings.length > 0) {
        return json({ error: "Cannot delete guest with active bookings" }, { status: 400 });
      }
      await db.user.delete({
        where: { id: guestId }
      });
      return json({ success: "Guest deleted successfully" });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Guest action error:", error);
    if (error.code === "P2002") {
      return json({ error: "Email already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Guests() {
  const { user, guests } = useLoaderData();
  const actionData = useActionData();
  const [opened, { open, close }] = useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const filteredGuests = useMemo(() => {
    let filtered = guests.filter((guest) => {
      const matchesSearch = guest.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || guest.lastName.toLowerCase().includes(searchQuery.toLowerCase()) || guest.email.toLowerCase().includes(searchQuery.toLowerCase()) || guest.phone && guest.phone.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || filterStatus === "active" && guest.bookings.some((b) => ["CONFIRMED", "CHECKED_IN"].includes(b.status)) || filterStatus === "inactive" && !guest.bookings.some((b) => ["CONFIRMED", "CHECKED_IN"].includes(b.status));
      return matchesSearch && matchesStatus;
    });
    return filtered;
  }, [guests, searchQuery, filterStatus]);
  const handleEdit = (guest) => {
    setEditingGuest(guest);
    openEdit();
  };
  const getStatusColor = (status) => {
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
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: "Guests Management" }),
      ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER") && /* @__PURE__ */ jsx(Button, { leftSection: /* @__PURE__ */ jsx(IconPlus, { size: 16 }), onClick: open, children: "Add Guest" })
    ] }),
    actionData && "error" in actionData && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        children: actionData.error
      }
    ),
    actionData && "success" in actionData && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Success",
        color: "green",
        children: actionData.success
      }
    ),
    /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsx(
        TextInput,
        {
          placeholder: "Search guests...",
          leftSection: /* @__PURE__ */ jsx(IconSearch, { size: 16 }),
          value: searchQuery,
          onChange: (event) => setSearchQuery(event.currentTarget.value),
          style: { flexGrow: 1 }
        }
      ),
      /* @__PURE__ */ jsx(
        Select,
        {
          placeholder: "Filter by status",
          value: filterStatus,
          onChange: (value) => setFilterStatus(value || "all"),
          data: [
            { value: "all", label: "All Guests" },
            { value: "active", label: "Active Guests" },
            { value: "inactive", label: "Inactive Guests" }
          ],
          style: { minWidth: 150 }
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs(Card, { children: [
      /* @__PURE__ */ jsx(Group, { justify: "space-between", mb: "md", children: /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
        "Showing ",
        filteredGuests.length,
        " of ",
        guests.length,
        " guests"
      ] }) }),
      /* @__PURE__ */ jsxs(Table, { striped: true, highlightOnHover: true, children: [
        /* @__PURE__ */ jsx(Table.Thead, { children: /* @__PURE__ */ jsxs(Table.Tr, { children: [
          /* @__PURE__ */ jsx(Table.Th, { children: "Guest Information" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Contact" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Total Bookings" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Latest Booking" }),
          /* @__PURE__ */ jsx(Table.Th, { children: "Joined" }),
          ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER") && /* @__PURE__ */ jsx(Table.Th, { children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx(Table.Tbody, { children: filteredGuests.length === 0 ? /* @__PURE__ */ jsx(Table.Tr, { children: /* @__PURE__ */ jsx(Table.Td, { colSpan: 6, style: { textAlign: "center", padding: "2rem" }, children: /* @__PURE__ */ jsxs(Stack, { align: "center", gap: "sm", children: [
          /* @__PURE__ */ jsx(IconInfoCircle, { size: 48, color: "gray" }),
          /* @__PURE__ */ jsx(Text, { c: "dimmed", children: searchQuery || filterStatus !== "all" ? "No guests found matching your criteria" : "No guests available" })
        ] }) }) }) : filteredGuests.map((guest) => /* @__PURE__ */ jsxs(Table.Tr, { children: [
          /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs(Text, { fw: 500, children: [
              guest.firstName,
              " ",
              guest.lastName
            ] }),
            /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: guest.email })
          ] }) }),
          /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs("div", { children: [
            guest.phone && /* @__PURE__ */ jsx(Text, { size: "sm", children: guest.phone }),
            guest.address && /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: guest.address })
          ] }) }),
          /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsx(Text, { fw: 500, children: guest.bookings.length }) }),
          /* @__PURE__ */ jsx(Table.Td, { children: guest.bookings.length > 0 ? /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Badge, { color: getStatusColor(guest.bookings[0].status), size: "sm", children: guest.bookings[0].status.replace("_", " ") }),
            /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: format(new Date(guest.bookings[0].checkIn), "MMM dd, yyyy") })
          ] }) : /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: "No bookings" }) }),
          /* @__PURE__ */ jsx(Table.Td, { children: format(new Date(guest.createdAt), "MMM dd, yyyy") }),
          ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER") && /* @__PURE__ */ jsx(Table.Td, { children: /* @__PURE__ */ jsxs(Group, { gap: "xs", children: [
            /* @__PURE__ */ jsx(
              ActionIcon,
              {
                variant: "subtle",
                color: "blue",
                onClick: () => handleEdit(guest),
                children: /* @__PURE__ */ jsx(IconEdit, { size: 16 })
              }
            ),
            /* @__PURE__ */ jsxs(Form, { method: "post", style: { display: "inline" }, children: [
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "delete" }),
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "guestId", value: guest.id }),
              /* @__PURE__ */ jsx(
                ActionIcon,
                {
                  variant: "subtle",
                  color: "red",
                  type: "submit",
                  onClick: (e) => {
                    if (!confirm("Are you sure you want to delete this guest?")) {
                      e.preventDefault();
                    }
                  },
                  children: /* @__PURE__ */ jsx(IconTrash, { size: 16 })
                }
              )
            ] })
          ] }) })
        ] }, guest.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Modal, { opened, onClose: close, title: "Add New Guest", size: "lg", children: /* @__PURE__ */ jsxs(Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "create" }),
      /* @__PURE__ */ jsxs(Stack, { children: [
        /* @__PURE__ */ jsxs(Group, { grow: true, children: [
          /* @__PURE__ */ jsx(
            TextInput,
            {
              label: "First Name",
              placeholder: "John",
              name: "firstName",
              required: true
            }
          ),
          /* @__PURE__ */ jsx(
            TextInput,
            {
              label: "Last Name",
              placeholder: "Doe",
              name: "lastName",
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Email",
            placeholder: "john.doe@example.com",
            name: "email",
            type: "email",
            required: true
          }
        ),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Password",
            placeholder: "Enter password",
            name: "password",
            type: "password",
            required: true
          }
        ),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Phone",
            placeholder: "+1234567890",
            name: "phone"
          }
        ),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Address",
            placeholder: "123 Main Street, City",
            name: "address"
          }
        ),
        /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", onClick: close, children: "Add Guest" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Modal, { opened: editOpened, onClose: closeEdit, title: "Edit Guest", size: "lg", children: editingGuest && /* @__PURE__ */ jsxs(Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "update" }),
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "guestId", value: editingGuest.id }),
      /* @__PURE__ */ jsxs(Stack, { children: [
        /* @__PURE__ */ jsxs(Group, { grow: true, children: [
          /* @__PURE__ */ jsx(
            TextInput,
            {
              label: "First Name",
              placeholder: "John",
              name: "firstName",
              defaultValue: editingGuest.firstName,
              required: true
            }
          ),
          /* @__PURE__ */ jsx(
            TextInput,
            {
              label: "Last Name",
              placeholder: "Doe",
              name: "lastName",
              defaultValue: editingGuest.lastName,
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Email",
            value: editingGuest.email,
            disabled: true,
            description: "Email cannot be changed"
          }
        ),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Phone",
            placeholder: "+1234567890",
            name: "phone",
            defaultValue: editingGuest.phone || ""
          }
        ),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Address",
            placeholder: "123 Main Street, City",
            name: "address",
            defaultValue: editingGuest.address || ""
          }
        ),
        /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: closeEdit, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", onClick: closeEdit, children: "Update Guest" })
        ] })
      ] })
    ] }) })
  ] }) });
}
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: Guests,
  loader: loader$7,
  meta: meta$5
}, Symbol.toStringTag, { value: "Module" }));
const meta$4 = () => {
  return [
    { title: "Dashboard - Apartment Management" },
    { name: "description", content: "Apartment management dashboard" }
  ];
};
async function loader$6({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const [
    totalRooms,
    availableRooms,
    totalBookings,
    todayCheckIns,
    todayCheckOuts,
    pendingMaintenance,
    totalRevenue,
    criticalCheckouts
  ] = await Promise.all([
    db.room.count(),
    db.room.count({ where: { status: "AVAILABLE" } }),
    db.booking.count({ where: { status: { not: "CANCELLED" } } }),
    db.booking.count({
      where: {
        checkIn: {
          gte: new Date((/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0)),
          lt: new Date((/* @__PURE__ */ new Date()).setHours(23, 59, 59, 999))
        },
        status: "CONFIRMED"
      }
    }),
    db.booking.count({
      where: {
        checkOut: {
          gte: new Date((/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0)),
          lt: new Date((/* @__PURE__ */ new Date()).setHours(23, 59, 59, 999))
        },
        status: "CHECKED_IN"
      }
    }),
    db.maintenanceLog.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } }
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" }
    }),
    db.booking.count({
      where: {
        checkOut: {
          gte: /* @__PURE__ */ new Date(),
          lte: new Date((/* @__PURE__ */ new Date()).getTime() + 2 * 60 * 60 * 1e3)
          // Next 2 hours
        },
        status: "CHECKED_IN"
      }
    })
  ]);
  const occupancyRate = totalRooms > 0 ? (totalRooms - availableRooms) / totalRooms * 100 : 0;
  return json({
    user,
    stats: {
      totalRooms,
      availableRooms,
      occupiedRooms: totalRooms - availableRooms,
      totalBookings,
      todayCheckIns,
      todayCheckOuts,
      pendingMaintenance,
      totalRevenue: totalRevenue._sum.amount || 0,
      occupancyRate,
      criticalCheckouts
    }
  });
}
function Dashboard() {
  const { user, stats } = useLoaderData();
  const statCards = [
    {
      title: "Total Rooms",
      value: stats.totalRooms,
      description: `${stats.availableRooms} available`,
      icon: IconBed,
      color: "blue"
    },
    {
      title: "Today's Check-ins",
      value: stats.todayCheckIns,
      description: "Guests arriving",
      icon: IconCalendar,
      color: "green"
    },
    {
      title: "Today's Check-outs",
      value: stats.todayCheckOuts,
      description: "Guests departing",
      icon: IconUsers,
      color: "orange"
    },
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      description: "All time",
      icon: IconCurrencyDollar,
      color: "yellow"
    },
    {
      title: "Occupancy Rate",
      value: `${stats.occupancyRate.toFixed(1)}%`,
      description: `${stats.occupiedRooms}/${stats.totalRooms} rooms`,
      icon: IconTrendingUp,
      color: "violet"
    },
    {
      title: "Maintenance",
      value: stats.pendingMaintenance,
      description: "Pending tasks",
      icon: IconAlertTriangle,
      color: stats.pendingMaintenance > 0 ? "red" : "gray"
    }
  ];
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: "Dashboard" }),
      /* @__PURE__ */ jsx(Badge, { size: "lg", variant: "light", children: user == null ? void 0 : user.role })
    ] }),
    /* @__PURE__ */ jsxs(Text, { c: "dimmed", children: [
      "Welcome back, ",
      user == null ? void 0 : user.firstName,
      "! Here's what's happening at your apartment complex today."
    ] }),
    stats.criticalCheckouts > 0 && /* @__PURE__ */ jsxs(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconAlertTriangle, { size: 16 }),
        title: "Critical Checkouts Alert",
        color: "red",
        action: /* @__PURE__ */ jsx(Button, { component: Link, to: "/dashboard/monitoring", size: "compact-sm", variant: "white", children: "View Details" }),
        children: [
          stats.criticalCheckouts,
          " tenant(s) need to check out within the next 2 hours!"
        ]
      }
    ),
    /* @__PURE__ */ jsx(Grid, { children: statCards.map((stat, index) => /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, lg: 4 }, children: /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", h: "100%", children: [
      /* @__PURE__ */ jsx(Group, { justify: "space-between", mb: "md", children: /* @__PURE__ */ jsx(ThemeIcon, { size: "xl", variant: "light", color: stat.color, children: /* @__PURE__ */ jsx(stat.icon, { size: 24 }) }) }),
      /* @__PURE__ */ jsx(Text, { size: "xl", fw: 700, mb: "xs", children: stat.value }),
      /* @__PURE__ */ jsx(Text, { size: "sm", fw: 500, mb: "xs", children: stat.title }),
      /* @__PURE__ */ jsx(Text, { size: "xs", c: "dimmed", children: stat.description })
    ] }) }, index)) }),
    stats.occupancyRate > 0 && /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", children: [
      /* @__PURE__ */ jsx(Title, { order: 4, mb: "md", children: "Apartment Occupancy" }),
      /* @__PURE__ */ jsx(
        Progress,
        {
          value: stats.occupancyRate,
          size: "lg",
          radius: "md",
          color: stats.occupancyRate > 80 ? "red" : stats.occupancyRate > 60 ? "yellow" : "green"
        }
      ),
      /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", mt: "xs", children: [
        stats.occupiedRooms,
        " of ",
        stats.totalRooms,
        " rooms occupied (",
        stats.occupancyRate.toFixed(1),
        "%)"
      ] })
    ] })
  ] }) });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Dashboard,
  loader: loader$6,
  meta: meta$4
}, Symbol.toStringTag, { value: "Module" }));
const meta$3 = () => {
  return [
    { title: "Rooms - Apartment Management" },
    { name: "description", content: "Manage apartment units" }
  ];
};
async function loader$5({ request }) {
  await requireUserId(request);
  const user = await getUser(request);
  const rooms = await db.room.findMany({
    orderBy: { number: "asc" }
  });
  return json({ user, rooms });
}
async function action$3({ request }) {
  await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  try {
    if (intent === "create") {
      const number = formData.get("number");
      const type = formData.get("type");
      const floor = parseInt(formData.get("floor"));
      const capacity = parseInt(formData.get("capacity"));
      const pricePerNight = parseFloat(formData.get("pricePerNight"));
      const description = formData.get("description");
      if (!number || !type || !floor || !capacity || !pricePerNight) {
        return json({ error: "All required fields must be filled" }, { status: 400 });
      }
      await db.room.create({
        data: {
          number,
          type,
          floor,
          capacity,
          pricePerNight,
          description: description || null
        }
      });
      return json({ success: "Room created successfully" });
    }
    if (intent === "update-status") {
      const roomId = formData.get("roomId");
      const status = formData.get("status");
      await db.room.update({
        where: { id: roomId },
        data: { status }
      });
      return json({ success: "Room status updated successfully" });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Room action error:", error);
    if (error.code === "P2002") {
      return json({ error: "Room number already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Rooms() {
  const { user, rooms } = useLoaderData();
  const actionData = useActionData();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [floorFilter, setFloorFilter] = useState(null);
  const [capacityFilter, setCapacityFilter] = useState(null);
  const filterOptions = useMemo(() => {
    const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);
    const capacities = [...new Set(rooms.map((room) => room.capacity))].sort((a, b) => a - b);
    return {
      floors: floors.map((floor) => ({ value: floor.toString(), label: `Floor ${floor}` })),
      capacities: capacities.map((capacity) => ({ value: capacity.toString(), label: `${capacity} guests` }))
    };
  }, [rooms]);
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      var _a;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = room.number.toLowerCase().includes(query) || room.type.toLowerCase().includes(query) || ((_a = room.description) == null ? void 0 : _a.toLowerCase().includes(query)) || room.status.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (statusFilter && room.status !== statusFilter) return false;
      if (typeFilter && room.type !== typeFilter) return false;
      if (floorFilter && room.floor.toString() !== floorFilter) return false;
      if (capacityFilter && room.capacity.toString() !== capacityFilter) return false;
      return true;
    });
  }, [rooms, searchQuery, statusFilter, typeFilter, floorFilter, capacityFilter]);
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setTypeFilter(null);
    setFloorFilter(null);
    setCapacityFilter(null);
  };
  const hasActiveFilters = searchQuery || statusFilter || typeFilter || floorFilter || capacityFilter;
  const getStatusColor = (status) => {
    switch (status) {
      case "AVAILABLE":
        return "green";
      case "OCCUPIED":
        return "blue";
      case "MAINTENANCE":
        return "yellow";
      case "OUT_OF_ORDER":
        return "red";
      default:
        return "gray";
    }
  };
  return /* @__PURE__ */ jsx(DashboardLayout, { user, children: /* @__PURE__ */ jsxs(Stack, { children: [
    /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, children: "Rooms Management" }),
      ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER") && /* @__PURE__ */ jsx(Button, { leftSection: /* @__PURE__ */ jsx(IconPlus, { size: 16 }), onClick: open, children: "Add Room" })
    ] }),
    (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        children: actionData.error
      }
    ),
    (actionData == null ? void 0 : actionData.success) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Success",
        color: "green",
        children: actionData.success
      }
    ),
    /* @__PURE__ */ jsxs(Paper, { p: "md", withBorder: true, children: [
      /* @__PURE__ */ jsxs(Group, { mb: "md", children: [
        /* @__PURE__ */ jsx(IconFilter, { size: 20 }),
        /* @__PURE__ */ jsx(Text, { fw: 500, children: "Filters" }),
        hasActiveFilters && /* @__PURE__ */ jsx(Button, { size: "compact-sm", variant: "subtle", onClick: clearFilters, children: "Clear All" })
      ] }),
      /* @__PURE__ */ jsxs(Grid, { children: [
        /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, md: 4, lg: 2.4 }, children: /* @__PURE__ */ jsx(
          TextInput,
          {
            placeholder: "Search rooms...",
            leftSection: /* @__PURE__ */ jsx(IconSearch, { size: 16 }),
            value: searchQuery,
            onChange: (event) => setSearchQuery(event.currentTarget.value)
          }
        ) }),
        /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, md: 4, lg: 2.4 }, children: /* @__PURE__ */ jsx(
          Select,
          {
            placeholder: "All Statuses",
            data: [
              { value: "AVAILABLE", label: "Available" },
              { value: "OCCUPIED", label: "Occupied" },
              { value: "MAINTENANCE", label: "Maintenance" },
              { value: "OUT_OF_ORDER", label: "Out of Order" }
            ],
            value: statusFilter,
            onChange: setStatusFilter,
            clearable: true
          }
        ) }),
        /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, md: 4, lg: 2.4 }, children: /* @__PURE__ */ jsx(
          Select,
          {
            placeholder: "All Types",
            data: [
              { value: "SINGLE", label: "Single" },
              { value: "DOUBLE", label: "Double" },
              { value: "SUITE", label: "Suite" },
              { value: "DELUXE", label: "Deluxe" },
              { value: "PRESIDENTIAL", label: "Presidential" }
            ],
            value: typeFilter,
            onChange: setTypeFilter,
            clearable: true
          }
        ) }),
        /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, md: 4, lg: 2.4 }, children: /* @__PURE__ */ jsx(
          Select,
          {
            placeholder: "All Floors",
            data: filterOptions.floors,
            value: floorFilter,
            onChange: setFloorFilter,
            clearable: true
          }
        ) }),
        /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, md: 4, lg: 2.4 }, children: /* @__PURE__ */ jsx(
          Select,
          {
            placeholder: "All Capacities",
            data: filterOptions.capacities,
            value: capacityFilter,
            onChange: setCapacityFilter,
            clearable: true
          }
        ) })
      ] }),
      /* @__PURE__ */ jsx(Divider, { my: "md" }),
      /* @__PURE__ */ jsxs(Group, { justify: "space-between", children: [
        /* @__PURE__ */ jsxs(Text, { size: "sm", c: "dimmed", children: [
          "Showing ",
          filteredRooms.length,
          " of ",
          rooms.length,
          " rooms"
        ] }),
        hasActiveFilters && /* @__PURE__ */ jsxs(Badge, { variant: "light", color: "blue", children: [
          [
            searchQuery && "Search",
            statusFilter && "Status",
            typeFilter && "Type",
            floorFilter && "Floor",
            capacityFilter && "Capacity"
          ].filter(Boolean).length,
          " filter(s) active"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Grid, { children: filteredRooms.length === 0 ? /* @__PURE__ */ jsx(Grid.Col, { span: 12, children: /* @__PURE__ */ jsx(Paper, { p: "xl", withBorder: true, children: /* @__PURE__ */ jsxs(Stack, { align: "center", children: [
      /* @__PURE__ */ jsx(IconInfoCircle, { size: 48, color: "gray" }),
      /* @__PURE__ */ jsx(Text, { size: "lg", c: "dimmed", children: hasActiveFilters ? "No rooms match your filters" : "No rooms found" }),
      hasActiveFilters && /* @__PURE__ */ jsx(Button, { variant: "light", onClick: clearFilters, children: "Clear Filters" })
    ] }) }) }) : filteredRooms.map((room) => /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, sm: 6, lg: 4 }, children: /* @__PURE__ */ jsxs(Card, { shadow: "sm", p: "lg", h: "100%", children: [
      /* @__PURE__ */ jsxs(Group, { justify: "space-between", mb: "md", children: [
        /* @__PURE__ */ jsxs(Text, { fw: 600, size: "lg", children: [
          "Room ",
          room.number
        ] }),
        /* @__PURE__ */ jsx(Badge, { color: getStatusColor(room.status), size: "sm", children: room.status.replace("_", " ") })
      ] }),
      /* @__PURE__ */ jsxs(Stack, { gap: "xs", children: [
        /* @__PURE__ */ jsxs(Text, { size: "sm", children: [
          /* @__PURE__ */ jsx("strong", { children: "Type:" }),
          " ",
          room.type.replace("_", " ")
        ] }),
        /* @__PURE__ */ jsxs(Text, { size: "sm", children: [
          /* @__PURE__ */ jsx("strong", { children: "Floor:" }),
          " ",
          room.floor
        ] }),
        /* @__PURE__ */ jsxs(Text, { size: "sm", children: [
          /* @__PURE__ */ jsx("strong", { children: "Capacity:" }),
          " ",
          room.capacity,
          " guests"
        ] }),
        /* @__PURE__ */ jsxs(Text, { size: "sm", children: [
          /* @__PURE__ */ jsx("strong", { children: "Price:" }),
          " $",
          room.pricePerNight,
          "/night"
        ] }),
        room.description && /* @__PURE__ */ jsx(Text, { size: "sm", c: "dimmed", children: room.description })
      ] }),
      ((user == null ? void 0 : user.role) === "ADMIN" || (user == null ? void 0 : user.role) === "MANAGER" || (user == null ? void 0 : user.role) === "STAFF") && /* @__PURE__ */ jsxs(Form, { method: "post", style: { marginTop: "1rem" }, children: [
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "update-status" }),
        /* @__PURE__ */ jsx("input", { type: "hidden", name: "roomId", value: room.id }),
        /* @__PURE__ */ jsx(
          Select,
          {
            name: "status",
            data: [
              { value: "AVAILABLE", label: "Available" },
              { value: "OCCUPIED", label: "Occupied" },
              { value: "MAINTENANCE", label: "Maintenance" },
              { value: "OUT_OF_ORDER", label: "Out of Order" }
            ],
            defaultValue: room.status,
            onChange: (value) => {
              if (value) {
                const form = new FormData();
                form.append("intent", "update-status");
                form.append("roomId", room.id);
                form.append("status", value);
                fetch("/dashboard/rooms", {
                  method: "POST",
                  body: form
                }).then(() => window.location.reload());
              }
            }
          }
        )
      ] })
    ] }) }, room.id)) }),
    /* @__PURE__ */ jsx(Modal, { opened, onClose: close, title: "Add New Room", size: "lg", children: /* @__PURE__ */ jsxs(Form, { method: "post", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name: "intent", value: "create" }),
      /* @__PURE__ */ jsxs(Stack, { children: [
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Room Number",
            placeholder: "101",
            name: "number",
            required: true
          }
        ),
        /* @__PURE__ */ jsx(
          Select,
          {
            label: "Room Type",
            placeholder: "Select type",
            name: "type",
            data: [
              { value: "SINGLE", label: "Single" },
              { value: "DOUBLE", label: "Double" },
              { value: "SUITE", label: "Suite" },
              { value: "DELUXE", label: "Deluxe" },
              { value: "PRESIDENTIAL", label: "Presidential" }
            ],
            required: true
          }
        ),
        /* @__PURE__ */ jsxs(Group, { grow: true, children: [
          /* @__PURE__ */ jsx(
            NumberInput,
            {
              label: "Floor",
              placeholder: "1",
              name: "floor",
              min: 1,
              required: true
            }
          ),
          /* @__PURE__ */ jsx(
            NumberInput,
            {
              label: "Capacity",
              placeholder: "2",
              name: "capacity",
              min: 1,
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          NumberInput,
          {
            label: "Price per Night",
            placeholder: "100",
            name: "pricePerNight",
            min: 0,
            prefix: "$",
            decimalScale: 2,
            required: true
          }
        ),
        /* @__PURE__ */ jsx(
          Textarea,
          {
            label: "Description",
            placeholder: "Room description...",
            name: "description",
            rows: 3
          }
        ),
        /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", onClick: close, children: "Add Room" })
        ] })
      ] })
    ] }) })
  ] }) });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: Rooms,
  loader: loader$5,
  meta: meta$3
}, Symbol.toStringTag, { value: "Module" }));
const meta$2 = () => {
  return [
    { title: "Register - Apartment Management" },
    { name: "description", content: "Create a new apartment management account" }
  ];
};
async function loader$4({ request }) {
  const user = await getUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return json({});
}
async function action$2({ request }) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const phone = formData.get("phone");
  const address = formData.get("address");
  if (!email || !password || !firstName || !lastName) {
    return json({ error: "All required fields must be filled" }, { status: 400 });
  }
  if (password.length < 6) {
    return json({ error: "Password must be at least 6 characters long" }, { status: 400 });
  }
  try {
    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
      phone: phone || void 0,
      address: address || void 0
    });
    return createUserSession(user.id, "/dashboard");
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "P2002") {
      return json({ error: "An account with this email already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Register() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx(Container, { size: "xs", py: "xl", children: /* @__PURE__ */ jsxs(Paper, { withBorder: true, shadow: "md", p: "xl", radius: "md", children: [
    /* @__PURE__ */ jsx(Title, { order: 2, ta: "center", mb: "md", children: "Create account" }),
    /* @__PURE__ */ jsx(Text, { c: "dimmed", size: "sm", ta: "center", mb: "xl", children: "Join our apartment management system" }),
    (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        mb: "md",
        children: actionData.error
      }
    ),
    /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(Stack, { children: [
      /* @__PURE__ */ jsxs(Group, { grow: true, children: [
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "First Name",
            placeholder: "John",
            name: "firstName",
            required: true,
            disabled: isSubmitting
          }
        ),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            label: "Last Name",
            placeholder: "Doe",
            name: "lastName",
            required: true,
            disabled: isSubmitting
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          label: "Email",
          placeholder: "your@email.com",
          name: "email",
          type: "email",
          required: true,
          disabled: isSubmitting
        }
      ),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          label: "Phone",
          placeholder: "Your phone number",
          name: "phone",
          disabled: isSubmitting
        }
      ),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          label: "Address",
          placeholder: "Your address",
          name: "address",
          disabled: isSubmitting
        }
      ),
      /* @__PURE__ */ jsx(
        PasswordInput,
        {
          label: "Password",
          placeholder: "At least 6 characters",
          name: "password",
          required: true,
          disabled: isSubmitting
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "submit",
          fullWidth: true,
          loading: isSubmitting,
          loaderProps: { type: "dots" },
          children: isSubmitting ? "Creating account..." : "Create account"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs(Text, { c: "dimmed", size: "sm", ta: "center", mt: "md", children: [
      "Already have an account?",
      " ",
      /* @__PURE__ */ jsx(Anchor, { component: Link, to: "/login", size: "sm", children: "Sign in" })
    ] })
  ] }) });
}
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: Register,
  loader: loader$4,
  meta: meta$2
}, Symbol.toStringTag, { value: "Module" }));
const loader$3 = async () => {
  const health = {
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  };
  return json(health, {
    headers: {
      "Cache-Control": "no-cache"
    }
  });
};
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
async function action$1({ request }) {
  return logout(request);
}
async function loader$2() {
  return new Response("Method not allowed", { status: 405 });
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const meta$1 = () => {
  return [
    { title: "Platinum Apartment - Premium Accommodation" },
    { name: "description", content: "Experience luxury and comfort at our premium apartment complex." }
  ];
};
async function loader$1({ request }) {
  const user = await getUser(request);
  return json({ user });
}
function Index() {
  const { user } = useLoaderData();
  const amenities = [
    { icon: IconBed, title: "Luxury Rooms", description: "Comfortable and spacious rooms with modern amenities" },
    { icon: IconWifi, title: "Free WiFi", description: "High-speed internet access throughout the complex" },
    { icon: IconCar, title: "Parking", description: "Complimentary parking for all residents" },
    { icon: IconPool, title: "Swimming Pool", description: "Outdoor pool with stunning city views" },
    { icon: IconChefHat, title: "Restaurant", description: "Fine dining with international cuisine" },
    { icon: IconMassage, title: "Spa & Wellness", description: "Relaxation and rejuvenation services" }
  ];
  return /* @__PURE__ */ jsxs(Container, { size: "xl", py: "xl", children: [
    /* @__PURE__ */ jsx(Center, { mb: "xl", children: /* @__PURE__ */ jsxs(Stack, { align: "center", gap: "md", children: [
      /* @__PURE__ */ jsx(Title, { size: 48, fw: 700, c: "white", ta: "center", children: "🏨 Platinum Apartment" }),
      /* @__PURE__ */ jsx(Text, { size: "xl", ta: "center", c: "dimmed", maw: 600, children: "Experience the finest in hospitality with our premium accommodations, world-class amenities, and exceptional service." }),
      /* @__PURE__ */ jsx(Group, { children: user ? /* @__PURE__ */ jsx(Button, { component: Link, to: "/dashboard", size: "lg", children: "Go to Dashboard" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { component: Link, to: "/login", size: "lg", children: "Sign In" }),
        /* @__PURE__ */ jsx(Button, { component: Link, to: "/register", variant: "outline", size: "lg", children: "Register" })
      ] }) })
    ] }) }),
    /* @__PURE__ */ jsx(Title, { order: 2, ta: "center", mb: "xl", children: "Apartment Amenities" }),
    "      ",
    /* @__PURE__ */ jsx(Grid, { gutter: "lg", children: amenities.map((amenity, index) => /* @__PURE__ */ jsx(Grid.Col, { span: { base: 12, md: 6, lg: 4 }, children: /* @__PURE__ */ jsx(Card, { shadow: "sm", p: "lg", h: "100%", children: /* @__PURE__ */ jsxs(Stack, { align: "center", ta: "center", children: [
      /* @__PURE__ */ jsx(ThemeIcon, { size: "xl", variant: "light", color: "blue", children: /* @__PURE__ */ jsx(amenity.icon, { size: 24 }) }),
      /* @__PURE__ */ jsx(Title, { order: 4, children: amenity.title }),
      /* @__PURE__ */ jsx(Text, { c: "dimmed", children: amenity.description })
    ] }) }) }, index)) }),
    /* @__PURE__ */ jsx(Center, { mt: "xl", children: /* @__PURE__ */ jsxs(Stack, { align: "center", gap: "md", children: [
      /* @__PURE__ */ jsx(Title, { order: 2, ta: "center", children: "Ready to Experience Luxury?" }),
      /* @__PURE__ */ jsx(Text, { ta: "center", c: "dimmed", maw: 500, children: "Book your stay with us and enjoy unparalleled comfort and service. Our dedicated staff is here to make your visit unforgettable." }),
      !user && /* @__PURE__ */ jsx(Button, { component: Link, to: "/register", size: "lg", variant: "gradient", children: "Book Now" })
    ] }) })
  ] });
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Index,
  loader: loader$1,
  meta: meta$1
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => {
  return [
    { title: "Login - Apartment Management" },
    { name: "description", content: "Sign in to your apartment management account" }
  ];
};
async function loader({ request }) {
  const user = await getUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return json({});
}
async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/dashboard";
  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }
  try {
    const user = await verifyUser(email, password);
    if (!user) {
      return json({ error: "Invalid email or password" }, { status: 400 });
    }
    return createUserSession(user.id, redirectTo);
  } catch (error) {
    console.error("Login error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
function Login() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx(Container, { size: "xs", py: "xl", children: /* @__PURE__ */ jsxs(Paper, { withBorder: true, shadow: "md", p: "xl", radius: "md", children: [
    /* @__PURE__ */ jsx(Title, { order: 2, ta: "center", mb: "md", children: "Welcome back" }),
    /* @__PURE__ */ jsx(Text, { c: "dimmed", size: "sm", ta: "center", mb: "xl", children: "Sign in to your apartment management account" }),
    (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(
      Alert,
      {
        icon: /* @__PURE__ */ jsx(IconInfoCircle, { size: 16 }),
        title: "Error",
        color: "red",
        mb: "md",
        children: actionData.error
      }
    ),
    /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(Stack, { children: [
      /* @__PURE__ */ jsx(
        TextInput,
        {
          label: "Email",
          placeholder: "your@email.com",
          name: "email",
          type: "email",
          required: true,
          disabled: isSubmitting
        }
      ),
      /* @__PURE__ */ jsx(
        PasswordInput,
        {
          label: "Password",
          placeholder: "Your password",
          name: "password",
          required: true,
          disabled: isSubmitting
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          type: "submit",
          fullWidth: true,
          loading: isSubmitting,
          loaderProps: { type: "dots" },
          children: isSubmitting ? "Signing in..." : "Sign in"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs(Text, { c: "dimmed", size: "sm", ta: "center", mt: "md", children: [
      "Don't have an account?",
      " ",
      /* @__PURE__ */ jsx(Anchor, { component: Link, to: "/register", size: "sm", children: "Create account" })
    ] })
  ] }) });
}
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: Login,
  loader,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BDOQfj-N.js", "imports": ["/assets/components-C4PRGKvj.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-DqWFrk8Z.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/Button-BnDQv5QN.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/get-contrast-color-eLaeemQb.js", "/assets/use-id-CERWC921.js", "/assets/Group-Di6LCSVE.js", "/assets/Modal-DGehu6Yg.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/objectWithoutPropertiesLoose-Cv5OCJ0e.js"], "css": ["/assets/root-DwFRX2xK.css"] }, "routes/dashboard.maintenance": { "id": "routes/dashboard.maintenance", "parentId": "root", "path": "dashboard/maintenance", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.maintenance-LsE8nOAx.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Button-BnDQv5QN.js", "/assets/IconPlus-s8q-TQuC.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/IconBed-BsGsTKgU.js", "/assets/Table-BgFeYTs4.js", "/assets/format-Bu9WfNjO.js", "/assets/Modal-DGehu6Yg.js", "/assets/NumberInput-DLSkAwXW.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/InputBase-gTWN9iHu.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/objectWithoutPropertiesLoose-Cv5OCJ0e.js"], "css": [] }, "routes/dashboard.monitoring": { "id": "routes/dashboard.monitoring", "parentId": "root", "path": "dashboard/monitoring", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.monitoring-CPgi9RSm.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/format-Bu9WfNjO.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/ThemeIcon-D_dEcrCn.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconAlertTriangle-DFuG4EF5.js", "/assets/IconBed-BsGsTKgU.js", "/assets/Center-oTmovjkX.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/Grid-DiAWRBVG.js", "/assets/Button-BnDQv5QN.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/get-base-value-JqT_q0U7.js"], "css": [] }, "routes/dashboard.analytics": { "id": "routes/dashboard.analytics", "parentId": "root", "path": "dashboard/analytics", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.analytics-CXvHRs0f.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Button-BnDQv5QN.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/IconBed-BsGsTKgU.js", "/assets/get-base-value-JqT_q0U7.js", "/assets/Group-Di6LCSVE.js", "/assets/ThemeIcon-D_dEcrCn.js", "/assets/IconTrendingUp-Dg3EAXej.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/get-contrast-color-eLaeemQb.js"], "css": [] }, "routes/dashboard.bookings": { "id": "routes/dashboard.bookings", "parentId": "root", "path": "dashboard/bookings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.bookings-B_PWaAcl.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Button-BnDQv5QN.js", "/assets/IconPlus-s8q-TQuC.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/IconBed-BsGsTKgU.js", "/assets/TextInput-BnXTk2f9.js", "/assets/IconSearch-CCM7Vt_l.js", "/assets/Table-BgFeYTs4.js", "/assets/ActionIcon-CuT3bTp5.js", "/assets/IconTrash-BkbOyWXp.js", "/assets/Modal-DGehu6Yg.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/NumberInput-DLSkAwXW.js", "/assets/InputBase-gTWN9iHu.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/format-Bu9WfNjO.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/objectWithoutPropertiesLoose-Cv5OCJ0e.js"], "css": [] }, "routes/dashboard.payments": { "id": "routes/dashboard.payments", "parentId": "root", "path": "dashboard/payments", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.payments-CDBle5xB.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Button-BnDQv5QN.js", "/assets/IconPlus-s8q-TQuC.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/IconBed-BsGsTKgU.js", "/assets/Table-BgFeYTs4.js", "/assets/Modal-DGehu6Yg.js", "/assets/format-Bu9WfNjO.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/InputBase-gTWN9iHu.js", "/assets/CloseButton-Dp9Chenx.js"], "css": [] }, "routes/dashboard.guests": { "id": "routes/dashboard.guests", "parentId": "root", "path": "dashboard/guests", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.guests-2H_OCzfS.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Button-BnDQv5QN.js", "/assets/IconPlus-s8q-TQuC.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/IconBed-BsGsTKgU.js", "/assets/TextInput-BnXTk2f9.js", "/assets/IconSearch-CCM7Vt_l.js", "/assets/Table-BgFeYTs4.js", "/assets/ActionIcon-CuT3bTp5.js", "/assets/IconTrash-BkbOyWXp.js", "/assets/Modal-DGehu6Yg.js", "/assets/format-Bu9WfNjO.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/InputBase-gTWN9iHu.js", "/assets/CloseButton-Dp9Chenx.js"], "css": [] }, "routes/dashboard._index": { "id": "routes/dashboard._index", "parentId": "root", "path": "dashboard", "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard._index-KiHbqDfm.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/IconBed-BsGsTKgU.js", "/assets/IconTrendingUp-Dg3EAXej.js", "/assets/IconAlertTriangle-DFuG4EF5.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Alert-j1ZULBv_.js", "/assets/Button-BnDQv5QN.js", "/assets/Grid-DiAWRBVG.js", "/assets/ThemeIcon-D_dEcrCn.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/get-contrast-color-eLaeemQb.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/get-base-value-JqT_q0U7.js"], "css": [] }, "routes/dashboard.rooms": { "id": "routes/dashboard.rooms", "parentId": "root", "path": "dashboard/rooms", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/dashboard.rooms-Bq1vTSin.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/DashboardLayout-iJTv5ljA.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Button-BnDQv5QN.js", "/assets/IconPlus-s8q-TQuC.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/Grid-DiAWRBVG.js", "/assets/TextInput-BnXTk2f9.js", "/assets/IconSearch-CCM7Vt_l.js", "/assets/IconBed-BsGsTKgU.js", "/assets/Modal-DGehu6Yg.js", "/assets/NumberInput-DLSkAwXW.js", "/assets/FocusTrap-jbxXVj5U.js", "/assets/use-id-CERWC921.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/InputBase-gTWN9iHu.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/get-base-value-JqT_q0U7.js", "/assets/objectWithoutPropertiesLoose-Cv5OCJ0e.js"], "css": [] }, "routes/register": { "id": "routes/register", "parentId": "root", "path": "register", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/register-DmRP4tZF.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/Container-B86_eE5r.js", "/assets/Button-BnDQv5QN.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/Group-Di6LCSVE.js", "/assets/TextInput-BnXTk2f9.js", "/assets/PasswordInput-CFLTRcd9.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/use-id-CERWC921.js", "/assets/InputBase-gTWN9iHu.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/ActionIcon-CuT3bTp5.js"], "css": [] }, "routes/health": { "id": "routes/health", "parentId": "root", "path": "health", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/health-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/logout": { "id": "routes/logout", "parentId": "root", "path": "logout", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/logout-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/_index--9xa8qxh.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/Container-B86_eE5r.js", "/assets/Center-oTmovjkX.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Group-Di6LCSVE.js", "/assets/Button-BnDQv5QN.js", "/assets/Grid-DiAWRBVG.js", "/assets/IconBed-BsGsTKgU.js", "/assets/ThemeIcon-D_dEcrCn.js", "/assets/create-safe-context-C00InVMJ.js", "/assets/get-base-value-JqT_q0U7.js"], "css": [] }, "routes/login": { "id": "routes/login", "parentId": "root", "path": "login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/login-BbzhZvyt.js", "imports": ["/assets/components-C4PRGKvj.js", "/assets/Container-B86_eE5r.js", "/assets/Button-BnDQv5QN.js", "/assets/createReactComponent-DHQulasG.js", "/assets/Alert-j1ZULBv_.js", "/assets/IconInfoCircle-BZ-Vof_0.js", "/assets/TextInput-BnXTk2f9.js", "/assets/PasswordInput-CFLTRcd9.js", "/assets/CloseButton-Dp9Chenx.js", "/assets/use-id-CERWC921.js", "/assets/InputBase-gTWN9iHu.js", "/assets/use-resolved-styles-api-Djkjaxcn.js", "/assets/ActionIcon-CuT3bTp5.js"], "css": [] } }, "url": "/assets/manifest-537afdc0.js", "version": "537afdc0" };
const mode = "production";
const assetsBuildDirectory = "build\\client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": false, "v3_singleFetch": true, "v3_lazyRouteDiscovery": true, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/dashboard.maintenance": {
    id: "routes/dashboard.maintenance",
    parentId: "root",
    path: "dashboard/maintenance",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/dashboard.monitoring": {
    id: "routes/dashboard.monitoring",
    parentId: "root",
    path: "dashboard/monitoring",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/dashboard.analytics": {
    id: "routes/dashboard.analytics",
    parentId: "root",
    path: "dashboard/analytics",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/dashboard.bookings": {
    id: "routes/dashboard.bookings",
    parentId: "root",
    path: "dashboard/bookings",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/dashboard.payments": {
    id: "routes/dashboard.payments",
    parentId: "root",
    path: "dashboard/payments",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/dashboard.guests": {
    id: "routes/dashboard.guests",
    parentId: "root",
    path: "dashboard/guests",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/dashboard._index": {
    id: "routes/dashboard._index",
    parentId: "root",
    path: "dashboard",
    index: true,
    caseSensitive: void 0,
    module: route7
  },
  "routes/dashboard.rooms": {
    id: "routes/dashboard.rooms",
    parentId: "root",
    path: "dashboard/rooms",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/register": {
    id: "routes/register",
    parentId: "root",
    path: "register",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/health": {
    id: "routes/health",
    parentId: "root",
    path: "health",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/logout": {
    id: "routes/logout",
    parentId: "root",
    path: "logout",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route12
  },
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
