import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";
import { processAndStoreImage, deleteImage } from "~/utils/image.server";
import { isR2Configured } from "~/utils/r2.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    switch (intent) {
      case "upload": {
        const imageData = formData.get("imageData") as string;
        const fileName = formData.get("fileName") as string;
        const folder = formData.get("folder") as string || "uploads";
        const userId = formData.get("userId") as string;

        if (!imageData || !fileName) {
          return json({ error: "Image data and filename are required" }, { status: 400 });
        }

        const result = await processAndStoreImage(imageData, fileName, folder, userId);
        
        return json({
          success: result.success,
          url: result.imageUrl,
          error: result.error,
          isR2: result.isR2
        });
      }

      case "delete": {
        const imageUrl = formData.get("imageUrl") as string;

        if (!imageUrl) {
          return json({ error: "Image URL is required" }, { status: 400 });
        }

        const result = await deleteImage(imageUrl);
        
        return json({
          success: result.success,
          error: result.error
        });
      }

      case "status": {
        return json({
          r2Configured: isR2Configured(),
          message: isR2Configured() 
            ? "R2 storage is available"
            : "Using fallback base64 storage"
        });
      }

      default:
        return json({ error: "Invalid intent" }, { status: 400 });
    }
  } catch (error) {
    console.error("Image API error:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function loader() {
  return json({ error: "Method not allowed" }, { status: 405 });
}
