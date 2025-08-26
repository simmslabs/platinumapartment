import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional: Your custom domain for R2

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn("R2 environment variables not fully configured. Image uploads will fall back to base64 storage.");
  console.warn("Missing:", {
    R2_ACCOUNT_ID: !R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !R2_ACCESS_KEY_ID, 
    R2_SECRET_ACCESS_KEY: !R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: !R2_BUCKET_NAME
  });
} else {
  console.log("R2 configuration loaded successfully");
  console.log("Account ID:", R2_ACCOUNT_ID);
  console.log("Access Key ID:", R2_ACCESS_KEY_ID?.substring(0, 8) + "...");
  console.log("Bucket Name:", R2_BUCKET_NAME);
}

// Initialize R2 client (S3-compatible)
const r2Client = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: "auto", // Cloudflare R2 uses "auto"
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      // Required for Cloudflare R2 compatibility
      forcePathStyle: false, // Changed to false for R2
      // Additional R2-specific configuration
      apiVersion: '2006-03-01',
    })
  : null;

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  key?: string;
}

/**
 * Upload an image to Cloudflare R2
 * @param imageData - Base64 image data or Buffer
 * @param fileName - Name for the file (will be prefixed with folder structure)
 * @param folder - Folder to organize files (e.g., 'profile-pictures', 'room-images')
 * @returns Promise with upload result
 */
export async function uploadToR2(
  imageData: string | Buffer,
  fileName: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  if (!r2Client || !isR2Configured()) {
    return {
      success: false,
      error: "R2 client not configured. Check environment variables."
    };
  }

  // Type assertion since we know R2_BUCKET_NAME is defined if isR2Configured() returns true
  const bucketName = R2_BUCKET_NAME as string;

  try {
    let buffer: Buffer;
    let contentType: string;

    // Handle base64 data
    if (typeof imageData === 'string') {
      if (imageData.startsWith('data:')) {
        // Extract content type and base64 data
        const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          return {
            success: false,
            error: "Invalid base64 image format"
          };
        }
        contentType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        return {
          success: false,
          error: "Invalid image data format"
        };
      }
    } else {
      buffer = imageData;
      contentType = 'image/jpeg'; // Default fallback
    }

    // Generate unique key with timestamp
    const timestamp = Date.now();
    const key = `${folder}/${timestamp}-${fileName}`;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    });

    try {
      await r2Client.send(command);
    } catch (error) {
      console.error('R2 upload command failed:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }

    // Generate public URL
    const publicUrl = R2_PUBLIC_URL && R2_PUBLIC_URL.startsWith('http') 
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    return {
      success: true,
      url: publicUrl,
      key: key
    };

  } catch (error) {
    console.error('R2 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * Delete an image from Cloudflare R2
 * @param key - The R2 object key to delete
 * @returns Promise with deletion result
 */
export async function deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
  if (!r2Client || !isR2Configured()) {
    return {
      success: false,
      error: "R2 client not configured"
    };
  }

  // Type assertion since we know R2_BUCKET_NAME is defined if isR2Configured() returns true
  const bucketName = R2_BUCKET_NAME as string;

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await r2Client.send(command);

    return { success: true };
  } catch (error) {
    console.error('R2 deletion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deletion error'
    };
  }
}

/**
 * Generate a presigned URL for direct upload to R2 (for large files)
 * @param key - The R2 object key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Promise with presigned URL
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!r2Client || !isR2Configured()) {
    return {
      success: false,
      error: "R2 client not configured"
    };
  }

  // Type assertion since we know R2_BUCKET_NAME is defined if isR2Configured() returns true
  const bucketName = R2_BUCKET_NAME as string;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });

    return {
      success: true,
      url: url
    };
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extract R2 key from URL
 * @param url - The full R2 URL
 * @returns The R2 key or null if not an R2 URL
 */
export function extractR2Key(url: string): string | null {
  if (!url) return null;
  
  // Handle custom domain URLs
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    return url.replace(`${R2_PUBLIC_URL}/`, '');
  }
  
  // Handle default R2 URLs
  const r2UrlPattern = new RegExp(`https://pub-${R2_ACCOUNT_ID}\\.r2\\.dev/(.+)`);
  const match = url.match(r2UrlPattern);
  return match ? match[1] : null;
}

/**
 * Check if R2 is properly configured
 * @returns boolean indicating if R2 is ready to use
 */
export function isR2Configured(): boolean {
  return r2Client !== null && 
         Boolean(R2_ACCOUNT_ID) && 
         Boolean(R2_ACCESS_KEY_ID) && 
         Boolean(R2_SECRET_ACCESS_KEY) && 
         Boolean(R2_BUCKET_NAME);
}

/**
 * Get R2 usage statistics (if needed for monitoring)
 * This would require additional R2 API calls and is optional
 */
export async function getR2Stats(): Promise<{
  configured: boolean;
  bucketName?: string;
  accountId?: string;
}> {
  return {
    configured: isR2Configured(),
    bucketName: R2_BUCKET_NAME,
    accountId: R2_ACCOUNT_ID
  };
}

/**
 * Validate image file before upload
 * @param imageData - Base64 image data
 * @param maxSizeBytes - Maximum file size in bytes (default: 5MB)
 * @returns Validation result
 */
export function validateImage(
  imageData: string,
  maxSizeBytes: number = 5 * 1024 * 1024 // 5MB default
): { valid: boolean; error?: string; sizeBytes?: number } {
  if (!imageData.startsWith('data:image/')) {
    return {
      valid: false,
      error: 'Invalid image format. Only images are allowed.'
    };
  }

  // Extract base64 data and calculate size
  const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return {
      valid: false,
      error: 'Invalid base64 format'
    };
  }

  const base64Data = matches[2];
  const sizeBytes = Math.ceil(base64Data.length * 0.75); // Approximate size of base64 decoded data

  if (sizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `Image too large. Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
      sizeBytes
    };
  }

  return {
    valid: true,
    sizeBytes
  };
}
