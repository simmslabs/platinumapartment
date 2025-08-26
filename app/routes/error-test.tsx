import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Button, Container, Stack, Title, Group, Text, Card, Badge } from "@mantine/core";
import { IconBug, IconTestPipe, IconShieldX } from "@tabler/icons-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const errorType = url.searchParams.get("type");

  switch (errorType) {
    case "401":
      throw new Response("Unauthorized - Authentication required", { status: 401 });
    case "403":
      throw new Response("Forbidden - Access denied", { status: 403 });
    case "404":
      throw new Response("Not Found - The requested resource does not exist", { status: 404 });
    case "500":
      throw new Response("Internal Server Error - Something went wrong on our end", { status: 500 });
    case "502":
      throw new Response("Bad Gateway - Server received invalid response", { status: 502 });
    case "503":
      throw new Response("Service Unavailable - Server temporarily unavailable", { status: 503 });
    case "runtime":
      throw new Error("This is a runtime error for testing the error boundary");
    case "network":
      // Simulate network timeout
      await new Promise(resolve => setTimeout(resolve, 5000));
      throw new Error("Request timeout");
    default:
      return json({ message: "Error test page - choose an error type to test" });
  }
}

export default function ErrorTest() {
  const errorTypes = [
    { type: "401", label: "401 Unauthorized", color: "blue", description: "Authentication required" },
    { type: "403", label: "403 Forbidden", color: "orange", description: "Access denied" },
    { type: "404", label: "404 Not Found", color: "yellow", description: "Resource not found" },
    { type: "500", label: "500 Server Error", color: "red", description: "Internal server error" },
    { type: "502", label: "502 Bad Gateway", color: "red", description: "Invalid server response" },
    { type: "503", label: "503 Unavailable", color: "red", description: "Service temporarily down" },
    { type: "runtime", label: "Runtime Error", color: "grape", description: "JavaScript runtime error" },
    { type: "network", label: "Network Timeout", color: "dark", description: "Simulated timeout error" },
  ];

  return (
    <Container size="md" className="py-16">
      <Stack gap="xl" align="center">
        <div className="text-center">
          <Title order={1} className="flex items-center justify-center gap-3 mb-4">
            <IconTestPipe size={40} className="text-blue-600" />
            Error Boundary Test Center
          </Title>
          <Text size="lg" c="dimmed" className="max-w-2xl">
            Test the beautiful animated error boundaries with different error types. 
            Each error will show a custom animated interface with appropriate styling and actions.
          </Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder className="w-full max-w-3xl">
          <Card.Section withBorder inheritPadding py="xs">
            <Group justify="space-between">
              <Text fw={500} className="flex items-center gap-2">
                <IconBug size={20} />
                Available Error Types
              </Text>
              <Badge color="blue" variant="light">
                Click to test
              </Badge>
            </Group>
          </Card.Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {errorTypes.map((error) => (
              <Button
                key={error.type}
                component="a"
                href={`/error-test?type=${error.type}`}
                variant="light"
                color={error.color}
                size="md"
                className="h-auto p-4 text-left justify-start"
              >
                <div>
                  <div className="font-semibold">{error.label}</div>
                  <div className="text-sm opacity-75 mt-1">{error.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder className="w-full max-w-3xl">
          <Card.Section withBorder inheritPadding py="xs">
            <Text fw={500} className="flex items-center gap-2">
              <IconShieldX size={20} />
              Features Demonstrated
            </Text>
          </Card.Section>

          <Stack gap="sm" mt="md">
            <Text size="sm">
              🎨 <strong>Animated Backgrounds:</strong> Smooth gradient animations and floating particles
            </Text>
            <Text size="sm">
              🔄 <strong>Smart Retry Logic:</strong> Progressive retry with visual feedback
            </Text>
            <Text size="sm">
              🌐 <strong>Network Awareness:</strong> Detects online/offline status
            </Text>
            <Text size="sm">
              📋 <strong>Error Details:</strong> Expandable error information with copy functionality
            </Text>
            <Text size="sm">
              🎯 <strong>Context-Aware Actions:</strong> Different buttons based on error type
            </Text>
            <Text size="sm">
              📱 <strong>Responsive Design:</strong> Looks great on all screen sizes
            </Text>
          </Stack>
        </Card>
        
        <Group gap="md">
          <Button
            component="a"
            href="/"
            variant="filled"
            size="lg"
          >
            Back to Dashboard
          </Button>
          
          <Button
            component="a"
            href="/nonexistent-page"
            variant="outline"
            size="lg"
          >
            Test 404 (Nonexistent Route)
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
