import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Anchor,
  Alert,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
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
    <Container size="xs" py="xl">
      <Paper withBorder shadow="md" p="xl" radius="md">
        <Title order={2} ta="center" mb="md">
          Welcome back
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Sign in to your apartment management account
        </Text>

        {actionData?.error && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Error"
            color="red"
            mb="md"
          >
            {actionData.error}
          </Alert>
        )}

        <Form method="post">
          <Stack>
            <TextInput
              label="Email"
              placeholder="your@email.com"
              name="email"
              type="email"
              required
              disabled={isSubmitting}
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              name="password"
              required
              disabled={isSubmitting}
            />

            <Button
              type="submit"
              fullWidth
              loading={isSubmitting}
              loaderProps={{ type: "dots" }}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </Stack>
        </Form>

        <Text c="dimmed" size="sm" ta="center" mt="md">
          Don't have an account?{" "}
          <Anchor component={Link} to="/register" size="sm">
            Create account
          </Anchor>
        </Text>
      </Paper>
    </Container>
  );
}
