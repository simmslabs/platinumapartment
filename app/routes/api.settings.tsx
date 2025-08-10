import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";
import { getApiSettings } from "~/utils/settings.server";

function maskApiKey(key: string): string {
  if (key.length <= 8) return key;
  return key.substring(0, 4) + "•".repeat(key.length - 8) + key.substring(key.length - 4);
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "•".repeat(secret.length);
  return secret.substring(0, 4) + "•".repeat(Math.min(secret.length - 8, 20)) + secret.substring(secret.length - 4);
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  
  const settings = await getApiSettings();
  
  // Mask sensitive information for display
  const maskedSettings = {
    ...settings,
    resendApiKey: settings.resendApiKey ? maskApiKey(settings.resendApiKey) : "",
    mnotifyApiKey: settings.mnotifyApiKey ? maskApiKey(settings.mnotifyApiKey) : "",
    jwtSecret: settings.jwtSecret ? maskSecret(settings.jwtSecret) : "",
    sessionSecret: settings.sessionSecret ? maskSecret(settings.sessionSecret) : "",
  };

  return json({ settings: maskedSettings });
}
