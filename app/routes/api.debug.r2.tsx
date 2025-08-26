import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";
import { isR2Configured, getR2Stats } from "~/utils/r2.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    switch (intent) {
      case "check-config": {
        const stats = await getR2Stats();
        return json({
          r2Configured: isR2Configured(),
          ...stats,
          environmentVars: {
            R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
            R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
            R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
            R2_PUBLIC_URL: !!process.env.R2_PUBLIC_URL,
          }
        });
      }

      default:
        return json({ error: "Invalid intent" }, { status: 400 });
    }
  } catch (error) {
    console.error("Debug API error:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function loader() {
  return json({ error: "Method not allowed" }, { status: 405 });
}
