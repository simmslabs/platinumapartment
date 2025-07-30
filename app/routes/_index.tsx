import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Grid,
  Card,
  Stack,
  Center,
  ThemeIcon,
} from "@mantine/core";
import {
  IconBed,
  IconWifi,
  IconCar,
  IconPool,
  IconChefHat,
  IconMassage,
} from "@tabler/icons-react";
import { getUser } from "~/utils/session.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Platinum Apartment - Premium Accommodation" },
    { name: "description", content: "Experience luxury and comfort at our premium apartment complex." },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  return json({ user });
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();

  const amenities = [
    { icon: IconBed, title: "Luxury Rooms", description: "Comfortable and spacious rooms with modern amenities" },
    { icon: IconWifi, title: "Free WiFi", description: "High-speed internet access throughout the complex" },
    { icon: IconCar, title: "Parking", description: "Complimentary parking for all residents" },
    { icon: IconPool, title: "Swimming Pool", description: "Outdoor pool with stunning city views" },
    { icon: IconChefHat, title: "Restaurant", description: "Fine dining with international cuisine" },
    { icon: IconMassage, title: "Spa & Wellness", description: "Relaxation and rejuvenation services" },
  ];

  return (
    <Container size="xl" py="xl">
      <Center mb="xl">
        <Stack align="center" gap="md">
                    <Title size={48} fw={700} c="white" ta="center">
            🏨 Platinum Apartment
          </Title>
          <Text size="xl" ta="center" c="dimmed" maw={600}>
            Experience the finest in hospitality with our premium accommodations, 
            world-class amenities, and exceptional service.
          </Text>
          <Group>
            {user ? (
              <Button component={Link} to="/dashboard" size="lg">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button component={Link} to="/login" size="lg">
                  Sign In
                </Button>
                <Button component={Link} to="/register" variant="outline" size="lg">
                  Register
                </Button>
              </>
            )}
          </Group>
        </Stack>
      </Center>

        <Title order={2} ta="center" mb="xl">
        Apartment Amenities
        </Title>      <Grid gutter="lg">
        {amenities.map((amenity, index) => (
          <Grid.Col key={index} span={{ base: 12, md: 6, lg: 4 }}>
            <Card shadow="sm" p="lg" h="100%">
              <Stack align="center" ta="center">
                <ThemeIcon size="xl" variant="light" color="blue">
                  <amenity.icon size={24} />
                </ThemeIcon>
                <Title order={4}>{amenity.title}</Title>
                <Text c="dimmed">{amenity.description}</Text>
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      <Center mt="xl">
        <Stack align="center" gap="md">
          <Title order={2} ta="center">
            Ready to Experience Luxury?
          </Title>
          <Text ta="center" c="dimmed" maw={500}>
            Book your stay with us and enjoy unparalleled comfort and service. 
            Our dedicated staff is here to make your visit unforgettable.
          </Text>
          {!user && (
            <Button component={Link} to="/register" size="lg" variant="gradient">
              Book Now
            </Button>
          )}
        </Stack>
      </Center>
    </Container>
  );
}
