import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation, useLoaderData, Link } from "@remix-run/react";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import bcrypt from "bcryptjs";
import DashboardLayout from "~/components/DashboardLayout";
import { Title, Stack, Text, PasswordInput, Button, Alert, Group, Card, Progress } from "@mantine/core";
import React from "react";
import { IconInfoCircle, IconLock, IconArrowLeft } from "@tabler/icons-react";
import { emailService } from "~/utils/email.server";
import { mnotifyService } from "~/utils/mnotify.server";

// In-memory rate limiting map (ephemeral; for stronger guarantees persist to DB/Redis)
const passwordChangeAttempts = new Map<string, { count: number; lockUntil?: number }>();
const MAX_ATTEMPTS = 5; // attempts before lock
const LOCK_MINUTES = 15; // lock duration

function getRemainingLockSeconds(record?: { lockUntil?: number }) {
  if (!record?.lockUntil) return 0;
  const diff = record.lockUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export const meta: MetaFunction = () => ([
  { title: "Change Password - Apartment Management" },
  { name: "description", content: "Update your account password" },
]);

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  return json({ userId, user });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const currentPassword = (formData.get("currentPassword") as string || "").trim();
  const newPassword = (formData.get("newPassword") as string || "").trim();
  const confirmPassword = (formData.get("confirmPassword") as string || "").trim();

  const fieldErrors: Record<string, string> = {};

  // Rate limiting check
  const attemptRecord = passwordChangeAttempts.get(userId);
  const remainingLockSeconds = getRemainingLockSeconds(attemptRecord);
  if (remainingLockSeconds > 0) {
    const minutes = Math.ceil(remainingLockSeconds / 60);
    return json({ ok: false, formError: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }, { status: 429 });
  }

  if (!currentPassword) fieldErrors.currentPassword = "Current password is required";
  if (!newPassword) fieldErrors.newPassword = "New password is required";
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirm password is required";

  if (newPassword) {
    if (newPassword.length < 8) fieldErrors.newPassword = fieldErrors.newPassword || "Password must be at least 8 characters";
    if (!/[A-Z]/.test(newPassword)) fieldErrors.newPassword = fieldErrors.newPassword || "Must contain an uppercase letter";
    if (!/[a-z]/.test(newPassword)) fieldErrors.newPassword = fieldErrors.newPassword || "Must contain a lowercase letter";
    if (!/\d/.test(newPassword)) fieldErrors.newPassword = fieldErrors.newPassword || "Must contain a number";
    if (!/[^A-Za-z0-9]/.test(newPassword)) fieldErrors.newPassword = fieldErrors.newPassword || "Must contain a symbol";
  }

  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json({ ok: false, fieldErrors }, { status: 400 });
  }

  // Fetch user with password hash
  const user = await db.user.findUnique({ where: { id: userId }, select: { password: true, email: true, firstName: true, lastName: true, phone: true }});
  if (!user) return json({ ok: false, formError: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    // Increment failed attempt counter only for incorrect current password
    const rec = attemptRecord || { count: 0 };
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    }
    passwordChangeAttempts.set(userId, rec);
    return json({ ok: false, fieldErrors: { currentPassword: "Incorrect current password" }, attemptInfo: { remaining: MAX_ATTEMPTS - rec.count, locked: !!rec.lockUntil } }, { status: 400 });
  }

  // Prevent reusing same password hash
  const same = await bcrypt.compare(newPassword, user.password);
  if (same) return json({ ok: false, fieldErrors: { newPassword: "New password must be different" } }, { status: 400 });

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: userId }, data: { password: newHash, updatedAt: new Date() }});

  // Reset attempt counter on success
  passwordChangeAttempts.delete(userId);

  // Fire-and-forget security notifications (non-blocking)
  (async () => {
    try {
      if (user.email) {
        await emailService.sendCustomEmail({
          to: user.email,
          subject: "Your password was changed",
          html: `<p>Hi ${user.firstName || ''},</p><p>This is a confirmation that your password was successfully changed. If you did not perform this action, please reset your password immediately or contact support.</p><p>Time: ${new Date().toLocaleString()}<br/>If this wasn't you, please reply to this email.</p><p>— Security Team</p>`
        });
      }
    } catch (e) {
      console.warn("Password change email failed", e);
    }
    try {
      if (user.phone) {
        await mnotifyService.sendSMS({
          recipient: user.phone,
          message: `Your password was changed at ${new Date().toLocaleString()}. If this wasn't you, please contact support immediately.`
        });
      }
    } catch (e) {
      console.warn("Password change SMS failed", e);
    }
  })();

  return redirect("/dashboard/profile?passwordUpdated=1");
}

export default function ChangePassword() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fieldErrors = (actionData && 'fieldErrors' in actionData) ? actionData.fieldErrors as Record<string,string> : undefined;
  const formError = (actionData && 'formError' in actionData) ? actionData.formError as string : undefined;
  const nav = useNavigation();
  const isSubmitting = nav.state === 'submitting';
  const [password, setPassword] = React.useState("");

  function passwordStrength(pw: string) {
    if (!pw) return { score: 0, label: "", color: "gray" };
    let score = 0;
    const lengthScore = Math.min(10, pw.length) * 5; // up to 50
    score += lengthScore;
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].reduce((acc, r) => acc + (r.test(pw) ? 1 : 0), 0);
    score += variety * 10; // up to 40
    // penalize repeats
    const repeats = pw.length - new Set(pw).size;
    score -= repeats * 1.5; // mild penalty
    score = Math.max(0, Math.min(100, Math.round(score)));
    let label = "Weak", color: string = "red";
    if (score >= 80) { label = "Strong"; color = "green"; }
    else if (score >= 60) { label = "Good"; color = "teal"; }
    else if (score >= 40) { label = "Fair"; color = "yellow"; }
    return { score, label, color };
  }
  const strength = passwordStrength(password);

  return (
    <DashboardLayout user={user}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Change Password</Title>
            <Text size="sm" c="dimmed">Update your account password</Text>
          </div>
          <Button component={Link} to="/dashboard/profile" variant="light" leftSection={<IconArrowLeft size={16} />}>Back</Button>
        </Group>

        {formError && (
          <Alert color="red" variant="light" icon={<IconInfoCircle size={16} />}>{formError}</Alert>
        )}

        <Card withBorder maw={480}>
          <Form method="post">
            <Stack gap="md">
              <PasswordInput
                label="Current Password"
                name="currentPassword"
                required
                error={fieldErrors?.currentPassword}
              />
              <div>
                <PasswordInput
                  label="New Password"
                  name="newPassword"
                  required
                  description="Min 8 chars, include upper, lower, number & symbol"
                  error={fieldErrors?.newPassword}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                />
                {password && (
                  <Stack gap={4} mt={6}>
                    <Progress value={strength.score} color={strength.color} size="sm" radius="xl" />
                    <Text size="xs" c={strength.color}>{strength.label} password</Text>
                  </Stack>
                )}
              </div>
              <PasswordInput
                label="Confirm New Password"
                name="confirmPassword"
                required
                error={fieldErrors?.confirmPassword}
              />

              <Group justify="flex-end" mt="sm">
                <Button type="submit" leftSection={<IconLock size={16} />} loading={isSubmitting} disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </Button>
              </Group>
            </Stack>
          </Form>
        </Card>
      </Stack>
    </DashboardLayout>
  );
}