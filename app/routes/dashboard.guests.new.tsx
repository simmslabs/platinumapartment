import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, Link, useLoaderData } from "@remix-run/react";
import {
  Title,
  Stack,
  Group,
  Text,
  Button,
  Card,
  Grid,
  Breadcrumbs,
  Anchor,
  TextInput,
  Select,
  LoadingOverlay,
  Alert,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconUserPlus,
  IconExclamationMark
} from "@tabler/icons-react";
import { DashboardLayout } from "~/components/DashboardLayout";
import { ProfilePictureUploader } from "~/components/ImageUploader";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { processAndStoreImage } from "~/utils/image.server";
import bcrypt from "bcryptjs";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const isEditing = data?.guest;
  return [
    { title: `${isEditing ? "Edit" : "Add New"} Guest - Apartment Management` },
    { name: "description", content: `${isEditing ? "Edit" : "Add a new"} guest information` },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  if (!user || user.role === "GUEST") {
    throw new Response("Access denied", { status: 403 });
  }

  const url = new URL(request.url);
  const guestId = url.searchParams.get("guestId");

  let guest = null;
  if (guestId) {
    guest = await db.user.findUnique({
      where: { id: guestId, role: "GUEST" },
    });

    if (!guest) {
      throw new Response("Guest not found", { status: 404 });
    }
  }

  return json({ user, guest });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  if (!user || user.role === "GUEST") {
    throw new Response("Access denied", { status: 403 });
  }

  const formData = await request.formData();
  const url = new URL(request.url);
  
  // Check for guestId in both form data and URL parameters
  const guestId = (formData.get("guestId") as string | null) || url.searchParams.get("guestId");
  const isEditing = Boolean(guestId);

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const idCard = formData.get("idCard") as string;
  const gender = formData.get("gender") as string;
  const profilePicture = formData.get("profilePicture") as string;

  // Validation
  const errors: Record<string, string> = {};

  if (!firstName?.trim()) {
    errors.firstName = "First name is required";
  }

  if (!lastName?.trim()) {
    errors.lastName = "Last name is required";
  }

  if (!email?.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email format";
  }

  if (!phone?.trim()) {
    errors.phone = "Phone number is required";
  }

  if (!idCard?.trim()) {
    errors.idCard = "ID card number is required";
  }

  if (!gender?.trim()) {
    errors.gender = "Gender is required";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors, success: false }, { status: 400 });
  }

  try {
    if (isEditing) {
      // Check if guest exists
      if (!guestId) {
        return json(
          { errors: { _form: "Guest ID is required for editing" }, success: false },
          { status: 400 }
        );
      }

      const existingGuest = await db.user.findUnique({
        where: { id: guestId, role: "GUEST" },
      });

      if (!existingGuest) {
        return json(
          { errors: { _form: "Guest not found" }, success: false },
          { status: 404 }
        );
      }

      // Check if email is taken by another user
      const existingUser = await db.user.findFirst({
        where: {
          email: email.trim().toLowerCase(),
          NOT: { id: guestId }
        },
      });

      if (existingUser) {
        return json(
          { errors: { email: "A user with this email already exists" }, success: false },
          { status: 400 }
        );
      }

      // Check if ID card number is taken by another user
      if (idCard?.trim()) {
        const existingIdCard = await db.user.findFirst({
          where: {
            idCard: idCard.trim(),
            NOT: { id: guestId }
          },
        });

        if (existingIdCard) {
          return json(
            { errors: { idCard: "A user with this ID card number already exists" }, success: false },
            { status: 400 }
          );
        }
      }

      // Process profile picture if provided
      let finalProfilePicture = existingGuest.profilePicture;

      if (profilePicture && profilePicture !== "") {
        try {
          const result = await processAndStoreImage(profilePicture, "profile.jpg", "profile-pictures");
          if (result.success && result.imageUrl) {
            finalProfilePicture = result.imageUrl;
          } else {
            console.error("Error processing profile picture:", result.error);
            // Fall back to base64 if processing fails
            finalProfilePicture = profilePicture;
          }
        } catch (error) {
          console.error("Error processing profile picture:", error);
          // Fall back to base64 if processing fails
          finalProfilePicture = profilePicture;
        }
      }

      // Update the guest
      const updatedGuest = await db.user.update({
        where: { id: guestId },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          address: address?.trim() || null,
          idCard: idCard?.trim() || null,
          gender: gender as "MALE" | "FEMALE" | "OTHER" || null,
          profilePicture: finalProfilePicture,
        },
      });

      return redirect(`/dashboard/guests/${updatedGuest.id}?success=updated`);
    } else {
      // Creating new guest
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (existingUser) {
        return json(
          { errors: { email: "A user with this email already exists" }, success: false },
          { status: 400 }
        );
      }

      // Check if ID card number already exists
      if (idCard?.trim()) {
        const existingIdCard = await db.user.findFirst({
          where: { idCard: idCard.trim() },
        });

        if (existingIdCard) {
          return json(
            { errors: { idCard: "A user with this ID card number already exists" }, success: false },
            { status: 400 }
          );
        }
      }

      // Generate a temporary password (user can change it later)
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Process profile picture if provided
      let processedImageUrl: string | null = null;

      if (profilePicture && profilePicture !== "") {
        try {
          const result = await processAndStoreImage(profilePicture, "profile.jpg", "profile-pictures");
          if (result.success && result.imageUrl) {
            processedImageUrl = result.imageUrl;
          } else {
            console.error("Error processing profile picture:", result.error);
            // Fall back to base64 if processing fails
            processedImageUrl = profilePicture;
          }
        } catch (error) {
          console.error("Error processing profile picture:", error);
          // Fall back to base64 if processing fails
          processedImageUrl = profilePicture;
        }
      }

      // Create the new guest
      const newGuest = await db.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          phone: phone.trim(),
          address: address?.trim() || null,
          idCard: idCard?.trim() || null,
          gender: gender as "MALE" | "FEMALE" | "OTHER" || null,
          profilePicture: processedImageUrl,
          role: "GUEST",
        },
      });

      return redirect(`/dashboard/guests/${newGuest.id}?success=created`);
    }
  } catch (error) {
    console.error(`Error ${isEditing ? "updating" : "creating"} guest:`, error);
    return json(
      { errors: { _form: `Failed to ${isEditing ? "update" : "create"} guest. Please try again.` }, success: false },
      { status: 500 }
    );
  }
}

export default function NewGuestPage() {
  const { user, guest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = Boolean(guest);

  const handleProfilePictureChange = (url: string | null) => {
    form.setFieldValue('profilePicture', url || '');
  };

  // Helper function to get field errors
  const getFieldError = (field: string): string | undefined => {
    if (actionData?.errors && typeof actionData.errors === 'object') {
      // Check if the field exists in errors object
      const errors = actionData.errors as { [key: string]: string | undefined };
      return errors[field];
    }
    return undefined;
  };

  const form = useForm({
    initialValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      idCard: "",
      gender: "",
      profilePicture: "",
    },
    validate: {
      firstName: (value) => (!value?.trim() ? "First name is required" : null),
      lastName: (value) => (!value?.trim() ? "Last name is required" : null),
      email: (value) => {
        if (!value?.trim()) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email format";
        return null;
      },
      phone: (value) => (!value?.trim() ? "Phone number is required" : null),
      idCard: (value) => (!value?.trim() ? "ID card number is required" : null),
      gender: (value) => (!value?.trim() ? "Gender is required" : null),
    },
  });

  // Set form values when editing a guest
  useEffect(() => {
    if (guest) {
      form.setValues({
        firstName: guest.firstName || "",
        lastName: guest.lastName || "",
        email: guest.email || "",
        phone: guest.phone || "",
        address: guest.address || "",
        idCard: guest.idCard || "",
        gender: guest.gender || "",
        profilePicture: guest.profilePicture || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest]);

  const _onSubmit = async (data: typeof form.values) => {
    setIsSubmitting(true);
    setSubmitError(null); // Clear any previous errors
    
    try {
      const formData = new FormData();
      
      // Add all form fields
      formData.set('firstName', data.firstName);
      formData.set('lastName', data.lastName);
      formData.set('email', data.email);
      formData.set('phone', data.phone);
      formData.set('address', data.address || '');
      formData.set('idCard', data.idCard);
      formData.set('gender', data.gender);
      formData.set('profilePicture', data.profilePicture || '');
      
      // Add guest ID when editing
      if (isEditing && guest) {
        formData.set('guestId', guest.id);
      }
      
      const response = await fetch(window.location.pathname + window.location.search, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        // Check if response is a redirect
        if (response.redirected || response.status === 302) {
          window.location.href = response.url;
        } else {
          // Handle success - redirect manually
          if (isEditing && guest) {
            window.location.href = `/dashboard/guests/${guest.id}?success=updated`;
          } else {
            window.location.href = '/dashboard/guests?success=created';
          }
        }
      } else {
        // Handle error response
        const errorData = await response.json();
        setSubmitError(errorData.errors?._form || 'An error occurred while submitting the form');
      }
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout user={user}>
      <Stack gap="lg">
        {/* Header with Breadcrumbs */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Breadcrumbs>
              <Anchor component={Link} to="/dashboard">Dashboard</Anchor>
              <Anchor component={Link} to="/dashboard/guests">Guests</Anchor>
              {isEditing && guest ? (
                <>
                  <Anchor component={Link} to={`/dashboard/guests/${guest.id}`}>
                    {guest.firstName} {guest.lastName}
                  </Anchor>
                  <Text>Edit</Text>
                </>
              ) : (
                <Text>New Guest</Text>
              )}
            </Breadcrumbs>
            <Title order={1}>{isEditing ? "Edit Guest" : "Add New Guest"}</Title>
          </Stack>

          <Button
            component={Link}
            to={isEditing && guest ? `/dashboard/guests/${guest.id}` : "/dashboard/guests"}
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
          >
            {isEditing ? "Back to Guest" : "Back to Guests"}
          </Button>
        </Group>

        {/* Error Alert - Server Side */}
        {actionData?.errors && "_form" in actionData.errors && (
          <Alert
            icon={<IconExclamationMark size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {actionData.errors._form}
          </Alert>
        )}

        {/* Error Alert - Client Side */}
        {submitError && (
          <Alert
            icon={<IconExclamationMark size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {submitError}
          </Alert>
        )}

        {/* Main Form */}
        <Card withBorder>
          <LoadingOverlay visible={isSubmitting} />

          <form
            onSubmit={form.onSubmit(_onSubmit)}
          >
            <Stack gap="lg">
              <Title order={3}>{isEditing ? "Edit Guest Information" : "Guest Information"}</Title>

              {/* Profile Picture Section */}
              <ProfilePictureUploader
                userId={guest?.id || `temp_${Date.now()}`}
                value={form.values.profilePicture}
                onChange={handleProfilePictureChange}
              />

              {/* Personal Information */}
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="First Name"
                    required
                    {...form.getInputProps("firstName")}
                    error={getFieldError("firstName")}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Last Name"
                    required
                    {...form.getInputProps("lastName")}
                    error={getFieldError("lastName")}
                  />
                </Grid.Col>
              </Grid>

              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Email Address"
                    type="email"
                    required
                    {...form.getInputProps("email")}
                    error={getFieldError("email")}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Phone Number"
                    required
                    placeholder="+233 XX XXX XXXX"
                    {...form.getInputProps("phone")}
                    error={getFieldError("phone")}
                  />
                </Grid.Col>
              </Grid>

              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="ID Card Number"
                    required
                    placeholder="e.g., GHA-123456789-0"
                    {...form.getInputProps("idCard")}
                    error={getFieldError("idCard")}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Gender"
                    required
                    placeholder="Select gender"
                    data={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                    {...form.getInputProps("gender")}
                    error={getFieldError("gender")}
                  />
                </Grid.Col>
              </Grid>

              <TextInput
                label="Address"
                placeholder="Full address (optional)"
                {...form.getInputProps("address")}
                error={getFieldError("address")}
              />

              {/* Action Buttons */}
              <Group justify="flex-end" gap="md" pt="md">
                <Button
                  component={Link}
                  to={isEditing && guest ? `/dashboard/guests/${guest.id}` : "/dashboard/guests"}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  leftSection={<IconUserPlus size={16} />}
                  loading={isSubmitting}
                >
                  {isEditing ? "Update Guest" : "Create Guest"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </DashboardLayout>
  );
}
