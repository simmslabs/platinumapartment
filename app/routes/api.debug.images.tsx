import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { processAndStoreImage } from "~/utils/image.server";
import { isR2Configured } from "~/utils/r2.server";
import { db } from "~/utils/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "test-image") {
    // Test base64 data (1x1 red pixel PNG)
    const testBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    
    try {
      console.log("=== Debug: Testing image processing ===");
      console.log("Input data length:", testBase64.length);
      console.log("R2 configured:", isR2Configured());
      
      const result = await processAndStoreImage(testBase64, "test.png", "profile-pictures");
      
      console.log("Processing result:", result);
      
      return json({
        success: true,
        processingResult: {
          success: result.success,
          hasImageUrl: !!result.imageUrl,
          imageUrlType: result.imageUrl ? 
            (result.imageUrl.startsWith('data:') ? 'base64' : 
             result.imageUrl.startsWith('http') ? 'url' : 'unknown') : 'none',
          imageUrlLength: result.imageUrl?.length,
          imageUrlPreview: result.imageUrl?.substring(0, 100),
          error: result.error,
          isR2: result.isR2,
          fullImageUrl: result.imageUrl
        },
        r2Configured: isR2Configured(),
        env: {
          hasR2AccountId: !!process.env.R2_ACCOUNT_ID,
          hasR2AccessKey: !!process.env.R2_ACCESS_KEY_ID,
          hasR2SecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
          hasR2Bucket: !!process.env.R2_BUCKET_NAME,
          r2PublicUrl: process.env.R2_PUBLIC_URL,
          r2AccountId: process.env.R2_ACCOUNT_ID,
          r2BucketName: process.env.R2_BUCKET_NAME
        }
      });
    } catch (error) {
      console.error("=== Debug: Error processing image ===", error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  if (action === "check-guests") {
    try {
      const guests = await db.user.findMany({
        where: { role: 'GUEST' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
        take: 5
      });
      
      const guestData = guests.map(guest => ({
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`,
        hasProfilePicture: !!guest.profilePicture,
        profilePictureType: guest.profilePicture ? 
          (guest.profilePicture.startsWith('data:') ? 'base64' : 
           guest.profilePicture.startsWith('http') ? 'url' : 'unknown') : 'none',
        profilePictureLength: guest.profilePicture?.length,
        profilePicturePreview: guest.profilePicture?.substring(0, 100)
      }));

      return json({
        success: true,
        guestCount: guests.length,
        guests: guestData
      });
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return json({
    message: "Debug endpoint for image processing",
    availableActions: [
      "?action=test-image - Test image processing function",
      "?action=check-guests - Check guest profile picture data"
    ]
  });
}
