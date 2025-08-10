import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Group,
  Modal,
  Select,
  TextInput,
  Alert,
  Text,
  Card,
  ActionIcon,
  Switch,
  NumberInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconInfoCircle, IconTrash, IconEdit, IconCreditCard } from "@tabler/icons-react";
import { format } from "date-fns";
import { DashboardLayout } from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import type { PaymentAccount } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [
    { title: "Payment Accounts - Apartment Management" },
    { name: "description", content: "Manage payment accounts and methods" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  const paymentAccounts = await db.paymentAccount.findMany({
    orderBy: {
      accountName: "asc",
    },
  });

  return json({ user, paymentAccounts });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  console.log("Action called with intent:", intent);
  console.log("Form data:", Object.fromEntries(formData.entries()));

  try {
    if (intent === "create") {
      const accountName = formData.get("accountName") as string;
      const type = formData.get("type") as any;
      const provider = formData.get("provider") as any;
      const accountNumber = formData.get("accountNumber") as string;
      const bankName = formData.get("bankName") as string;
      const isActive = formData.get("isActive") === "on";

      console.log("Creating payment account:", {
        userId,
        accountName,
        type,
        provider,
        accountNumber,
        bankName,
        isActive,
      });

      if (!accountName || !type || !provider) {
        return json({ error: "Account name, type, and provider are required" }, { status: 400 });
      }

      const newAccount = await db.paymentAccount.create({
        data: {
          userId,
          accountName,
          type,
          provider,
          accountNumber: accountNumber || null,
          bankName: bankName || null,
          isActive,
        },
      });

      console.log("Payment account created:", newAccount);
      return json({ success: "Payment account created successfully" });
    }

    if (intent === "update") {
      const id = formData.get("id") as string;
      const accountName = formData.get("accountName") as string;
      const type = formData.get("type") as any;
      const provider = formData.get("provider") as any;
      const accountNumber = formData.get("accountNumber") as string;
      const bankName = formData.get("bankName") as string;
      const isActive = formData.get("isActive") === "on";

      console.log("Updating payment account:", {
        id,
        accountName,
        type,
        provider,
        accountNumber,
        bankName,
        isActive,
      });

      if (!id) {
        return json({ error: "Payment account ID is required for update" }, { status: 400 });
      }

      const updatedAccount = await db.paymentAccount.update({
        where: { id },
        data: {
          accountName,
          type,
          provider,
          accountNumber: accountNumber || null,
          bankName: bankName || null,
          isActive,
        },
      });

      console.log("Payment account updated:", updatedAccount);
      return json({ success: "Payment account updated successfully" });
    }

    if (intent === "delete") {
      const id = formData.get("id") as string;

      if (!id) {
        return json({ error: "Payment account ID is required" }, { status: 400 });
      }

      await db.paymentAccount.delete({
        where: { id },
      });

      return json({ success: "Payment account deleted successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Payment account action error:", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function PaymentAccounts() {
  const { user, paymentAccounts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const getTypeColor = (type: PaymentAccount["type"]) => {
    switch (type) {
      case "CREDIT_CARD":
        return "blue";
      case "DEBIT_CARD":
        return "cyan";
      case "BANK_ACCOUNT":
        return "green";
      case "MOBILE_WALLET":
        return "orange";
      case "DIGITAL_WALLET":
        return "violet";
      case "CRYPTO_WALLET":
        return "purple";
      default:
        return "gray";
    }
  };

  const getProviderColor = (provider: PaymentAccount["provider"]) => {
    switch (provider) {
      case "STRIPE":
        return "violet";
      case "PAYPAL":
        return "blue";
      case "MTN_MOBILE_MONEY":
        return "yellow";
      case "VODAFONE_CASH":
        return "red";
      case "GCB_BANK":
        return "green";
      case "ECOBANK":
        return "orange";
      default:
        return "gray";
    }
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    open();
  };

  const handleDelete = (accountId: string) => {
    if (confirm("Are you sure you want to delete this payment account? This action cannot be undone.")) {
      const form = new FormData();
      form.append("intent", "delete");
      form.append("id", accountId);
      fetch("/dashboard/payment-accounts", {
        method: "POST",
        body: form,
      }).then(() => window.location.reload());
    }
  };

  const handleModalClose = () => {
    setEditingAccount(null);
    close();
  };

  // Close modal on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData) {
      handleModalClose();
    }
  }, [actionData]);

  return (
    <DashboardLayout user={user}>
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Payment Accounts</Title>
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Add Payment Account
            </Button>
          )}
        </Group>

        {actionData && 'error' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {actionData.error}
          </Alert>
        )}

        {actionData && 'success' in actionData && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Success"
            color="green"
            variant="light"
          >
            {actionData.success}
          </Alert>
        )}

        <Card withBorder>
          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Provider</Table.Th>
                <Table.Th>Account Number</Table.Th>
                <Table.Th>Bank Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paymentAccounts.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <IconCreditCard size={16} />
                      <Text fw={500}>{account.accountName || "Unknown Account"}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getTypeColor(account.type)} size="sm">
                      {account.type.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getProviderColor(account.provider)} size="sm">
                      {account.provider}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {account.accountNumber || "N/A"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {account.bankName || "N/A"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={account.isActive ? "green" : "red"} size="sm">
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {format(new Date(account.createdAt), "MMM dd, yyyy")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
                        <>
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => handleEdit(account)}
                            title="Edit account"
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          {user?.role === "ADMIN" && (
                            <ActionIcon
                              color="red"
                              variant="light"
                              size="sm"
                              onClick={() => handleDelete(account.id)}
                              title="Delete account"
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          )}
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {paymentAccounts.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed">
                      No payment accounts configured yet
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        </Card>

        <Modal 
          opened={opened} 
          onClose={handleModalClose} 
          title={editingAccount ? "Edit Payment Account" : "Add Payment Account"} 
          size="lg"
        >
          <Form method="post">
            <input type="hidden" name="intent" value={editingAccount ? "update" : "create"} />
            {editingAccount && <input type="hidden" name="id" value={editingAccount.id} />}
            <Stack>
              <TextInput
                label="Account Name"
                placeholder="e.g., Main Stripe Account"
                name="accountName"
                defaultValue={editingAccount?.accountName || ""}
                required
              />

              <Select
                label="Account Type"
                placeholder="Select account type"
                name="type"
                defaultValue={editingAccount?.type || ""}
                data={[
                  { value: "CREDIT_CARD", label: "Credit Card" },
                  { value: "DEBIT_CARD", label: "Debit Card" },
                  { value: "BANK_ACCOUNT", label: "Bank Account" },
                  { value: "MOBILE_WALLET", label: "Mobile Wallet" },
                  { value: "DIGITAL_WALLET", label: "Digital Wallet" },
                  { value: "CRYPTO_WALLET", label: "Crypto Wallet" },
                ]}
                required
              />

              <Select
                label="Provider"
                placeholder="Select payment provider"
                name="provider"
                defaultValue={editingAccount?.provider || ""}
                data={[
                  { value: "STRIPE", label: "Stripe" },
                  { value: "PAYPAL", label: "PayPal" },
                  { value: "MTN_MOBILE_MONEY", label: "MTN Mobile Money" },
                  { value: "VODAFONE_CASH", label: "Vodafone Cash" },
                  { value: "GCB_BANK", label: "GCB Bank" },
                  { value: "ECOBANK", label: "Ecobank" },
                  { value: "MANUAL", label: "Manual" },
                ]}
                required
              />

              <TextInput
                label="Account Number/ID (Optional)"
                placeholder="Account number or identifier"
                name="accountNumber"
                defaultValue={editingAccount?.accountNumber || ""}
              />

              <TextInput
                label="Bank Name (Optional)"
                placeholder="e.g., GCB Bank"
                name="bankName"
                defaultValue={editingAccount?.bankName || ""}
              />

              <Switch
                label="Active Account"
                name="isActive"
                defaultChecked={editingAccount?.isActive ?? true}
              />

              <Group justify="flex-end">
                <Button variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAccount ? "Update Account" : "Create Account"}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Modal>
      </Stack>
    </DashboardLayout>
  );
}
