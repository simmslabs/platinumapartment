import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { isR2Configured } from "~/utils/r2.server";
import { getImageInfo } from "~/utils/image.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  // Only allow admin users to access storage stats
  if (user?.role !== "ADMIN") {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get all users with profile pictures
    const usersWithImages = await db.user.findMany({
      where: {
        profilePicture: {
          not: null
        }
      },
      select: {
        id: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Analyze images
    let r2Images = 0;
    let base64Images = 0;
    let estimatedDatabaseSize = 0;
    let estimatedR2Size = 0;

    for (const user of usersWithImages) {
      if (user.profilePicture) {
        const imageInfo = getImageInfo(user.profilePicture);
        
        if (imageInfo.isR2) {
          r2Images++;
          // Estimate R2 size (average profile picture ~100KB)
          estimatedR2Size += 100 * 1024;
        } else if (imageInfo.isBase64) {
          base64Images++;
          estimatedDatabaseSize += imageInfo.estimatedSize || 0;
        }
      }
    }

    // Calculate recent upload activity
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentUploads = {
      day: await db.user.count({
        where: {
          profilePicture: { not: null },
          updatedAt: { gte: dayAgo }
        }
      }),
      week: await db.user.count({
        where: {
          profilePicture: { not: null },
          updatedAt: { gte: weekAgo }
        }
      }),
      month: await db.user.count({
        where: {
          profilePicture: { not: null },
          updatedAt: { gte: monthAgo }
        }
      })
    };

    const stats = {
      r2Configured: isR2Configured(),
      totalImages: usersWithImages.length,
      r2Images,
      base64Images,
      estimatedDatabaseSize,
      estimatedR2Size,
      recentUploads
    };

    return json(stats);

  } catch (error) {
    console.error("Storage stats error:", error);
    return json(
      { error: "Failed to fetch storage statistics" },
      { status: 500 }
    );
  }
}
