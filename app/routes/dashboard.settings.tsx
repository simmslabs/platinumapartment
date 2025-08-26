import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Title,
  Text,
  Card,
  Stack,
  Group,
  Button,
  TextInput,
  PasswordInput,
  Alert,
  Tabs,
  Grid,
  Paper,
  Badge,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Divider,
} from "@mantine/core";
import {
  IconSettings,
  IconKey,
  IconMail,
  IconMessage,
  IconShield,
  IconWorld,
  IconCheck,
  IconX,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconAlertTriangle,
} from "@tabler/icons-react";
import DashboardLayout from "~/components/DashboardLayout";
import { requireUserId, getUser } from "~/utils/session.server";
import { getApiSettings, updateApiSettings, validateApiSettings, getAllSettings, getSetting } from "~/utils/settings.server";
import { useState, useEffect } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Settings | Apartment Management" },
    { name: "description", content: "Manage system settings and API configurations" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);
  
  const settings = await getApiSettings();
  
  // Mask sensitive information for display
  const maskedSettings = {
    ...settings,
    resendApiKey: settings.resendApiKey ? maskApiKey(settings.resendApiKey) : "",
    mnotifyApiKey: settings.mnotifyApiKey ? maskApiKey(settings.mnotifyApiKey) : "",
    jwtSecret: settings.jwtSecret ? maskSecret(settings.jwtSecret) : "",
    sessionSecret: settings.sessionSecret ? maskSecret(settings.sessionSecret) : "",
  };

  return json({ user, settings: maskedSettings });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "updateApiKeys") {
    const settings = {
      resendApiKey: formData.get("resendApiKey") as string,
      mnotifyApiKey: formData.get("mnotifyApiKey") as string,
      mnotifySenderId: formData.get("mnotifySenderId") as string,
    };

    // Validate settings
    const errors = validateApiSettings(settings);
    if (errors.length > 0) {
      return json({ success: false, errors }, { status: 400 });
    }

    try {
      await updateApiSettings(settings);
      return json({ success: true, message: "API keys updated successfully" });
    } catch (error) {
      return json({ success: false, errors: ["Failed to update API keys"] }, { status: 500 });
    }
  }

  if (action === "updateSecurity") {
    const settings = {
      jwtSecret: formData.get("jwtSecret") as string,
      sessionSecret: formData.get("sessionSecret") as string,
    };

    const errors = validateApiSettings(settings);
    if (errors.length > 0) {
      return json({ success: false, errors }, { status: 400 });
    }

    try {
      await updateApiSettings(settings);
      return json({ success: true, message: "Security settings updated successfully" });
    } catch (error) {
      return json({ success: false, errors: ["Failed to update security settings"] }, { status: 500 });
    }
  }

  if (action === "updateGeneral") {
    const settings = {
      appUrl: formData.get("appUrl") as string,
    };

    const errors = validateApiSettings(settings);
    if (errors.length > 0) {
      return json({ success: false, errors }, { status: 400 });
    }

    try {
      await updateApiSettings(settings);
      return json({ success: true, message: "General settings updated successfully" });
    } catch (error) {
      return json({ success: false, errors: ["Failed to update general settings"] }, { status: 500 });
    }
  }

  if (action === "syncFromEnv") {
    try {
      // Get current env values and sync to database
      const envSettings = {
        resendApiKey: process.env.RESEND_API_KEY || "",
        mnotifyApiKey: process.env.MNOTIFY_API_KEY || "",
        mnotifySenderId: process.env.MNOTIFY_SENDER_ID || "",
        jwtSecret: process.env.JWT_SECRET || "",
        sessionSecret: process.env.SESSION_SECRET || "",
        appUrl: process.env.APP_URL || "",
      };

      await updateApiSettings(envSettings);
      return json({ success: true, message: "Settings synced from .env file to database successfully" });
    } catch (error) {
      return json({ success: false, errors: ["Failed to sync settings from .env file"] }, { status: 500 });
    }
  }

  return json({ success: false, errors: ["Invalid action"] }, { status: 400 });
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return key;
  return key.substring(0, 4) + "•".repeat(key.length - 8) + key.substring(key.length - 4);
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "•".repeat(secret.length);
  return secret.substring(0, 4) + "•".repeat(Math.min(secret.length - 8, 20)) + secret.substring(secret.length - 4);
}

export default function Settings() {
  const { user, settings: initialSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // State for current settings with real-time updates
  const [currentSettings, setCurrentSettings] = useState(initialSettings);
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Update settings state when loader data changes or after successful actions
  useEffect(() => {
    if (actionData?.success) {
      // Refresh settings from server after successful update
      refreshSettings();
      setIsDirty({});
    }
  }, [actionData]);

  // Function to refresh settings from the server
  const refreshSettings = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setCurrentSettings(data.settings);
        setIsDirty({});
      }
    } catch (error) {
      console.error('Failed to refresh settings:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle input changes for real-time state updates
  const handleSettingChange = (field: string, value: string) => {
    setCurrentSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(prev => ({
      ...prev,
      [field]: value !== initialSettings[field as keyof typeof initialSettings]
    }));
  };

  const toggleSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const generateSecret = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="xl">
        <Group>
          <ThemeIcon size="lg" color="blue">
            <IconSettings size={24} />
          </ThemeIcon>
          <div>
            <Title order={2}>Settings</Title>
            <Text c="dimmed">Manage system configuration and API keys (stored in database)</Text>
          </div>
          <Group style={{ marginLeft: "auto" }} gap="sm">
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={refreshSettings}
              loading={isRefreshing}
              disabled={isSubmitting}
            >
              Refresh
            </Button>
            <Form method="post">
              <input type="hidden" name="_action" value="syncFromEnv" />
              <Button
                type="submit"
                variant="light"
                color="blue"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                loading={isSubmitting}
              >
                Sync from .env
              </Button>
            </Form>
          </Group>
        </Group>

        {actionData?.success && 'message' in actionData && (
          <Alert
            icon={<IconCheck size={16} />}
            title="Success"
            color="green"
            variant="light"
          >
            {actionData.message}
          </Alert>
        )}

        {actionData && !actionData.success && 'errors' in actionData && (
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

        {Object.values(isDirty).some(Boolean) && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Unsaved Changes"
            color="yellow"
            variant="light"
          >
            You have unsaved changes. Make sure to save your settings before leaving this page.
          </Alert>
        )}

        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Database Storage"
          color="blue"
          variant="light"
        >
          Settings are now stored in the database for better management. Changes will be synchronized to the .env file for compatibility. 
          Use "Sync from .env" to import current environment variables into the database.
        </Alert>

        <Tabs defaultValue="api-keys" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="api-keys" leftSection={<IconKey size={16} />}>
              API Keys
            </Tabs.Tab>
            <Tabs.Tab value="security" leftSection={<IconShield size={16} />}>
              Security
            </Tabs.Tab>
            <Tabs.Tab value="general" leftSection={<IconWorld size={16} />}>
              General
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="api-keys" pt="xl">
            <Form method="post">
              <input type="hidden" name="_action" value="updateApiKeys" />
              
              <Card>
                <Stack gap="md">
                  <Group>
                    <ThemeIcon color="blue" size="lg">
                      <IconMail size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>Email Service (Resend)</Title>
                      <Text c="dimmed" size="sm">Configure email notifications and communications</Text>
                    </div>
                    <Badge color={currentSettings.resendApiKey ? "green" : "red"} variant="light" ml="auto">
                      {currentSettings.resendApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </Group>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <PasswordInput
                        label="Resend API Key"
                        description="Get your API key from resend.com dashboard"
                        placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                        defaultValue={currentSettings.resendApiKey}
                        name="resendApiKey"
                        onChange={(event) => handleSettingChange('resendApiKey', event.target.value)}
                        visible={showSecrets.resendApiKey}
                        onVisibilityChange={() => toggleSecret('resendApiKey')}
                        rightSection={
                          <Tooltip label="Visit resend.com">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => window.open('https://resend.com/api-keys', '_blank')}
                            >
                              <IconWorld size={16} />
                            </ActionIcon>
                          </Tooltip>
                        }
                      />
                    </Grid.Col>
                  </Grid>

                  <Divider />

                  <Group>
                    <ThemeIcon color="green" size="lg">
                      <IconMessage size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>SMS Service (MNotify)</Title>
                      <Text c="dimmed" size="sm">Configure SMS and WhatsApp notifications</Text>
                    </div>
                    <Badge color={currentSettings.mnotifyApiKey ? "green" : "red"} variant="light" ml="auto">
                      {currentSettings.mnotifyApiKey ? "Configured" : "Not Configured"}
                    </Badge>
                  </Group>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <PasswordInput
                        label="MNotify API Key"
                        description="Get your API key from mnotify.com dashboard"
                        placeholder="your-mnotify-api-key-here"
                        defaultValue={currentSettings.mnotifyApiKey}
                        name="mnotifyApiKey"
                        onChange={(event) => handleSettingChange('mnotifyApiKey', event.target.value)}
                        visible={showSecrets.mnotifyApiKey}
                        onVisibilityChange={() => toggleSecret('mnotifyApiKey')}
                        rightSection={
                          <Tooltip label="Visit mnotify.com">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => window.open('https://mnotify.com', '_blank')}
                            >
                              <IconWorld size={16} />
                            </ActionIcon>
                          </Tooltip>
                        }
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <TextInput
                        label="Sender ID"
                        description="Your approved sender ID (3-11 characters)"
                        placeholder="ApartmentMgmt"
                        defaultValue={currentSettings.mnotifySenderId}
                        name="mnotifySenderId"
                        onChange={(event) => handleSettingChange('mnotifySenderId', event.target.value)}
                        maxLength={11}
                      />
                    </Grid.Col>
                  </Grid>

                  <Group justify="flex-end" mt="md">
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      leftSection={<IconCheck size={16} />}
                      color={Object.values(isDirty).some(Boolean) ? "orange" : "blue"}
                    >
                      {Object.values(isDirty).some(Boolean) ? "Save Changes" : "Update API Keys"}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Form>
          </Tabs.Panel>

          <Tabs.Panel value="security" pt="xl">
            <Form method="post">
              <input type="hidden" name="_action" value="updateSecurity" />
              
              <Card>
                <Stack gap="md">
                  <Group>
                    <ThemeIcon color="red" size="lg">
                      <IconShield size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>Security Settings</Title>
                      <Text c="dimmed" size="sm">Manage authentication and session security</Text>
                    </div>
                  </Group>

                  <Alert
                    icon={<IconAlertTriangle size={16} />}
                    title="Security Notice"
                    color="yellow"
                    variant="light"
                  >
                    Changing these values will require all users to log in again. Make sure to use strong, unique secrets.
                  </Alert>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <PasswordInput
                        label="JWT Secret"
                        description="Secret key for JWT token signing (min 32 characters)"
                        placeholder="Generate a secure random string"
                        defaultValue={currentSettings.jwtSecret}
                        name="jwtSecret"
                        onChange={(event) => handleSettingChange('jwtSecret', event.target.value)}
                        visible={showSecrets.jwtSecret}
                        onVisibilityChange={() => toggleSecret('jwtSecret')}
                        rightSection={
                          <Tooltip label="Generate new secret">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => {
                                const input = document.querySelector('input[name="jwtSecret"]') as HTMLInputElement;
                                if (input) input.value = generateSecret();
                              }}
                            >
                              <IconRefresh size={16} />
                            </ActionIcon>
                          </Tooltip>
                        }
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <PasswordInput
                        label="Session Secret"
                        description="Secret key for session encryption (min 32 characters)"
                        placeholder="Generate a secure random string"
                        defaultValue={currentSettings.sessionSecret}
                        name="sessionSecret"
                        onChange={(event) => handleSettingChange('sessionSecret', event.target.value)}
                        visible={showSecrets.sessionSecret}
                        onVisibilityChange={() => toggleSecret('sessionSecret')}
                        rightSection={
                          <Tooltip label="Generate new secret">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => {
                                const input = document.querySelector('input[name="sessionSecret"]') as HTMLInputElement;
                                if (input) input.value = generateSecret();
                              }}
                            >
                              <IconRefresh size={16} />
                            </ActionIcon>
                          </Tooltip>
                        }
                      />
                    </Grid.Col>
                  </Grid>

                  <Group justify="flex-end" mt="md">
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      color={Object.values(isDirty).some(Boolean) ? "orange" : "red"}
                      leftSection={<IconShield size={16} />}
                    >
                      {Object.values(isDirty).some(Boolean) ? "Save Security Changes" : "Update Security Settings"}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Form>
          </Tabs.Panel>

          <Tabs.Panel value="general" pt="xl">
            <Form method="post">
              <input type="hidden" name="_action" value="updateGeneral" />
              
              <Card>
                <Stack gap="md">
                  <Group>
                    <ThemeIcon color="blue" size="lg">
                      <IconWorld size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>General Settings</Title>
                      <Text c="dimmed" size="sm">Configure application-wide settings</Text>
                    </div>
                  </Group>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <TextInput
                        label="Application URL"
                        description="The base URL where your application is hosted"
                        placeholder="https://yourdomain.com"
                        defaultValue={currentSettings.appUrl}
                        name="appUrl"
                        onChange={(event) => handleSettingChange('appUrl', event.target.value)}
                        leftSection={<IconWorld size={16} />}
                      />
                    </Grid.Col>
                  </Grid>

                  <Group justify="flex-end" mt="md">
                    <Button
                      type="submit"
                      loading={isSubmitting}
                      leftSection={<IconCheck size={16} />}
                      color={Object.values(isDirty).some(Boolean) ? "orange" : "blue"}
                    >
                      {Object.values(isDirty).some(Boolean) ? "Save Changes" : "Update General Settings"}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Form>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </DashboardLayout>
  );
}
