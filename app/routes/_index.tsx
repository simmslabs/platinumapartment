import type { MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  Container,
  Title,
  Text,
  Button,
  Stack,
  Center,
} from "@mantine/core";

export const meta: MetaFunction = () => {
  return [
    { title: "Platinum Apartment - Management System" },
    { name: "description", content: "Unauthorized access is prohibited." },
  ];
};

export async function loader() {
  // Redirect all users to the login page
  return redirect("/login");
}

export default function Index() {
  return (
    <Container size="xl" py="xl">
      <Center style={{ minHeight: '80vh' }}>
        <Stack align="center" gap="xl">
          <Title size={48} fw={700} ta="center">
            🏨 Platinum Apartment
          </Title>
          <Text size="xl" ta="center" c="dimmed" maw={600}>
            Access to this system is restricted to authorized personnel only.
            Please login with your credentials to continue.
          </Text>
          <Button component={Link} to="/login" size="lg">
            Login
          </Button>
        </Stack>
      </Center>
    </Container>
  );
}
