import { uploadToR2, deleteFromR2, extractR2Key, isR2Configured, validateImage } from "./r2.server";

export interface ImageProcessResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  isR2?: boolean;
}

/**
 * Process and store an image - either upload to R2 or store as base64
 * @param imageData - Base64 image data
 * @param fileName - Original filename or identifier
 * @param folder - Folder to organize images (e.g., 'profile-pictures', 'room-images')
 * @param userId - User ID for organizing files
 * @returns Promise with processing result
 */
export async function processAndStoreImage(
  imageData: string,
  fileName: string,
  folder: string = 'uploads',
  userId?: string
): Promise<ImageProcessResult> {
  // Validate image first
  const validation = validateImage(imageData);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  // Generate filename with user ID if provided
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const finalFileName = userId 
    ? `${userId}_${cleanFileName}`
    : cleanFileName;

  // Try R2 upload first if configured
  if (isR2Configured()) {
    try {
      console.log("Attempting R2 upload...");
      const uploadResult = await uploadToR2(imageData, finalFileName, folder);
      
      if (uploadResult.success && uploadResult.url) {
        console.log("R2 upload successful:", uploadResult.url);
        return {
          success: true,
          imageUrl: uploadResult.url,
          isR2: true
        };
      } else {
        console.warn("R2 upload failed:", uploadResult.error);
        // Fall through to base64 storage
      }
    } catch (error) {
      console.error("R2 upload error:", error);
      // Fall through to base64 storage
    }
  } else {
    console.log("R2 not configured, using base64 storage");
  }

  // Fallback to base64 storage
  // Ensure we return the original base64 data, not a constructed path
  if (!imageData.startsWith('data:')) {
    return {
      success: false,
      error: 'Invalid image data for base64 storage'
    };
  }

  return {
    success: true,
    imageUrl: imageData, // Store the original base64 data
    isR2: false
  };
}

/**
 * Delete an image - handles both R2 and base64 storage
 * @param imageUrl - The image URL or base64 data to delete
 * @returns Promise with deletion result
 */
export async function deleteImage(imageUrl: string): Promise<{ success: boolean; error?: string }> {
  if (!imageUrl) {
    return { success: true }; // Nothing to delete
  }

  // Check if it's an R2 URL
  const r2Key = extractR2Key(imageUrl);
  if (r2Key) {
    return await deleteFromR2(r2Key);
  }

  // For base64 data, just return success (no physical file to delete)
  return { success: true };
}

/**
 * Update profile picture for a user
 * @param userId - User ID
 * @param newImageData - New base64 image data
 * @param oldImageUrl - Previous image URL (for cleanup)
 * @returns Promise with update result
 */
export async function updateProfilePicture(
  userId: string,
  newImageData: string,
  oldImageUrl?: string | null
): Promise<ImageProcessResult> {
  // Process new image
  const result = await processAndStoreImage(
    newImageData,
    'profile.jpg',
    'profile-pictures',
    userId
  );

  if (result.success && oldImageUrl) {
    // Clean up old image (don't wait for completion)
    deleteImage(oldImageUrl).catch(error => {
      console.warn('Failed to delete old profile picture:', error);
    });
  }

  return result;
}

/**
 * Process multiple images (for room galleries, etc.)
 * @param imageDataArray - Array of base64 image data
 * @param folder - Folder to organize images
 * @param userId - User ID for organizing files
 * @returns Promise with array of processing results
 */
export async function processMultipleImages(
  imageDataArray: string[],
  folder: string = 'uploads',
  userId?: string
): Promise<ImageProcessResult[]> {
  const results: ImageProcessResult[] = [];

  for (let i = 0; i < imageDataArray.length; i++) {
    const imageData = imageDataArray[i];
    const fileName = `image_${i + 1}.jpg`;
    
    const result = await processAndStoreImage(imageData, fileName, folder, userId);
    results.push(result);
  }

  return results;
}

/**
 * Compress base64 image data (basic JPEG quality reduction)
 * @param imageData - Base64 image data
 * @param quality - Quality factor (0.1 to 1.0)
 * @returns Promise with compressed base64 data
 */
export function compressImage(imageData: string, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // This is a simple compression using Canvas API (would work in browser)
      // For server-side, you might want to use a library like sharp
      if (typeof window === 'undefined') {
        // Server-side: return original for now
        // In production, consider using sharp or similar
        resolve(imageData);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedData);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate optimized image variants (thumbnail, medium, large)
 * @param imageData - Original base64 image data
 * @param userId - User ID for organizing files
 * @param folder - Folder to organize images
 * @returns Promise with URLs for different sizes
 */
export async function generateImageVariants(
  imageData: string,
  userId: string,
  folder: string = 'uploads'
): Promise<{
  original?: string;
  large?: string;
  medium?: string;
  thumbnail?: string;
  error?: string;
}> {
  try {
    // For now, just store the original
    // In production, you might want to generate actual variants
    const result = await processAndStoreImage(imageData, 'original.jpg', folder, userId);
    
    if (result.success && result.imageUrl) {
      return {
        original: result.imageUrl,
        large: result.imageUrl,
        medium: result.imageUrl,
        thumbnail: result.imageUrl
      };
    } else {
      return { error: result.error || 'Failed to process image' };
    }
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get image metadata and info
 * @param imageUrl - Image URL or base64 data
 * @returns Image information
 */
export function getImageInfo(imageUrl: string): {
  isR2: boolean;
  isBase64: boolean;
  estimatedSize?: number;
  type?: string;
} {
  const isBase64 = imageUrl.startsWith('data:');
  const isR2 = !isBase64 && extractR2Key(imageUrl) !== null;

  let estimatedSize: number | undefined;
  let type: string | undefined;

  if (isBase64) {
    const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      type = matches[1];
      estimatedSize = Math.ceil(matches[2].length * 0.75);
    }
  }

  return {
    isR2,
    isBase64,
    estimatedSize,
    type
  };
}
