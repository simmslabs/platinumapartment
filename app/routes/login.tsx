import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Alert,
  Card,
} from "@mantine/core";
import { IconInfoCircle, IconBuildingStore, IconUser, IconLock } from "@tabler/icons-react";
import { verifyUser } from "~/utils/auth.server";
import { createUserSession, getUser } from "~/utils/session.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Login - Apartment Management" },
    { name: "description", content: "Sign in to your apartment management account" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirectTo") as string || "/dashboard";

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

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Container size={420} my={40}>
        <Card
          withBorder
          shadow="xl"
          p={40}
          radius="lg"
        >
          {/* Logo and Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: '16px'
            }}>
              <IconBuildingStore size={32} color="white" />
            </div>
            <Title order={1} size="h2" fw={700} c="dark">
              Platinum Apartments
            </Title>
            <Text c="dimmed" size="sm" mt={8}>
              Sign in to your account
            </Text>
          </div>

          {actionData?.error && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Error"
              color="red"
              mb="lg"
              radius="md"
            >
              {actionData.error}
            </Alert>
          )}

          <Form method="post">
            <Stack gap="md">
              <TextInput
                label="Email address"
                placeholder="Enter your email"
                name="email"
                type="email"
                required
                disabled={isSubmitting}
                leftSection={<IconUser size={16} />}
                radius="md"
                size="md"
                styles={{
                  input: {
                    border: '1px solid #e9ecef',
                    '&:focus': {
                      borderColor: '#667eea',
                      boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)'
                    }
                  }
                }}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                name="password"
                required
                disabled={isSubmitting}
                leftSection={<IconLock size={16} />}
                radius="md"
                size="md"
                styles={{
                  input: {
                    border: '1px solid #e9ecef',
                    '&:focus': {
                      borderColor: '#667eea',
                      boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.1)'
                    }
                  }
                }}
              />

              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                loaderProps={{ type: "dots" }}
                radius="md"
                size="md"
                mt="lg"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: 600
                }}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </Stack>
          </Form>

          {/* Footer */}
          <div style={{ 
            textAlign: 'center', 
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e9ecef'
          }}>
            <Text c="dimmed" size="sm">
              Authorized personnel only
            </Text>
            <Text c="dimmed" size="xs" mt={4}>
              Contact administrator for access
            </Text>
          </div>
        </Card>
      </Container>
    </div>
  );
}
