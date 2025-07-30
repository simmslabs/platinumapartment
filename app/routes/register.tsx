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
  Group,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { createUser } from "~/utils/auth.server";
import { createUserSession, getUser } from "~/utils/session.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Register - Apartment Management" },
    { name: "description", content: "Create a new apartment management account" },
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
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;

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
      phone: phone || undefined,
      address: address || undefined,
    });

    return createUserSession(user.id, "/dashboard");
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error.code === "P2002") {
      return json({ error: "An account with this email already exists" }, { status: 400 });
    }
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Register() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Container size="xs" py="xl">
      <Paper withBorder shadow="md" p="xl" radius="md">
        <Title order={2} ta="center" mb="md">
          Create account
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Join our apartment management system
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
            <Group grow>
              <TextInput
                label="First Name"
                placeholder="John"
                name="firstName"
                required
                disabled={isSubmitting}
              />
              <TextInput
                label="Last Name"
                placeholder="Doe"
                name="lastName"
                required
                disabled={isSubmitting}
              />
            </Group>

            <TextInput
              label="Email"
              placeholder="your@email.com"
              name="email"
              type="email"
              required
              disabled={isSubmitting}
            />

            <TextInput
              label="Phone"
              placeholder="Your phone number"
              name="phone"
              disabled={isSubmitting}
            />

            <TextInput
              label="Address"
              placeholder="Your address"
              name="address"
              disabled={isSubmitting}
            />

            <PasswordInput
              label="Password"
              placeholder="At least 6 characters"
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
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </Stack>
        </Form>

        <Text c="dimmed" size="sm" ta="center" mt="md">
          Already have an account?{" "}
          <Anchor component={Link} to="/login" size="sm">
            Sign in
          </Anchor>
        </Text>
      </Paper>
    </Container>
  );
}
