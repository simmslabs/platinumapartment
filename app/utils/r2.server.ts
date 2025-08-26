/**
 * Image Upload Utility - Base64 Only
 * This utility handles image uploads using base64 storage only.
 * No external cloud storage is used.
 */

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  key?: string;
}

/**
 * Upload an image using base64 storage
 * @param imageData - Base64 image data or Buffer
 * @param fileName - Name for the file (used for metadata)
 * @param folder - Folder to organize files (used for metadata)
 * @returns Promise with upload result
 */
export async function uploadToR2(
  imageData: string | Buffer,
  fileName: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  try {
    let base64Data: string;

    // Handle Buffer data by converting to base64
    if (Buffer.isBuffer(imageData)) {
      base64Data = `data:image/jpeg;base64,${imageData.toString('base64')}`;
    } else if (typeof imageData === 'string') {
      // Ensure the data is in proper base64 format
      if (imageData.startsWith('data:')) {
        base64Data = imageData;
      } else {
        // Assume it's raw base64 and add the data URL prefix
        base64Data = `data:image/jpeg;base64,${imageData}`;
      }
    } else {
      return {
        success: false,
        error: "Invalid image data format"
      };
    }

    // Validate the image
    const validation = validateImage(base64Data);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Generate a unique key for metadata
    const timestamp = Date.now();
    const key = `${folder}/${timestamp}-${fileName}`;

    // For base64 storage, we return the base64 data directly as the URL
    return {
      success: true,
      url: base64Data,
      key: key
    };

  } catch (error) {
    console.error('Image processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * Delete an image (no-op for base64 storage)
 * @param key - The image key (not used in base64 storage)
 * @returns Promise with deletion result
 */
export async function deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
  // For base64 storage, deletion is handled by removing the reference from the database
  // This function is kept for API compatibility
  console.log(`Delete operation for key: ${key} - handled by database reference removal`);
  return { success: true };
}

/**
 * Generate a presigned URL (returns the base64 data directly)
 * @param key - The image key (not used in base64 storage)
 * @param expiresIn - Not used for base64 storage
 * @returns Promise with the base64 URL
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  // For base64 storage, we can't generate presigned URLs
  // This function is kept for API compatibility
  return {
    success: false,
    error: "Presigned URLs not supported with base64 storage"
  };
}

/**
 * Check if R2 is configured (always returns false for base64-only)
 * @returns boolean indicating R2 is not used
 */
export function isR2Configured(): boolean {
  return false;
}

/**
 * Get storage statistics (base64 mode)
 */
export async function getR2Stats(): Promise<{
  configured: boolean;
  bucketName?: string;
  accountId?: string;
  storageMode: string;
}> {
  return {
    configured: false,
    storageMode: "base64",
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