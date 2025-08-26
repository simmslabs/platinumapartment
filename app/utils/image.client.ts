/**
 * Client-side image processing utilities
 */

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Compress and resize an image file or base64 data
 * @param input - File object or base64 string
 * @param options - Processing options
 * @returns Promise with processed base64 data
 */
export function processImage(
  input: File | string,
  options: ImageProcessingOptions = {}
): Promise<string> {
  const {
    maxWidth = 800,
    maxHeight = 1200,
    quality = 0.8,
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // Fill with white background for JPEG
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        // Draw the resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64
        const processedData = canvas.toDataURL(format, quality);
        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Handle File input
    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(input);
    } else {
      // Handle base64 string input
      img.src = input;
    }
  });
}

/**
 * Process image specifically for profile pictures (passport photo style)
 * @param input - File object or base64 string
 * @returns Promise with processed base64 data
 */
export function processProfilePicture(input: File | string): Promise<string> {
  return processImage(input, {
    maxWidth: 400,
    maxHeight: 600,
    quality: 0.85,
    format: 'image/jpeg'
  });
}

/**
 * Process image for room galleries
 * @param input - File object or base64 string
 * @returns Promise with processed base64 data
 */
export function processRoomImage(input: File | string): Promise<string> {
  return processImage(input, {
    maxWidth: 1200,
    maxHeight: 800,
    quality: 0.8,
    format: 'image/jpeg'
  });
}

/**
 * Validate image file before processing
 * @param file - File object to validate
 * @param maxSizeBytes - Maximum file size in bytes
 * @returns Validation result
 */
export function validateImageFile(
  file: File,
  maxSizeBytes: number = 5 * 1024 * 1024 // 5MB default
): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: 'Please select an image file'
    };
  }

  // Check supported formats
  const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedFormats.includes(file.type)) {
    return {
      valid: false,
      error: 'Supported formats: JPEG, PNG, WebP, GIF'
    };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / 1024 / 1024);
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`
    };
  }

  return { valid: true };
}

/**
 * Get image dimensions from file or base64 data
 * @param input - File object or base64 string
 * @returns Promise with image dimensions
 */
export function getImageDimensions(input: File | string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(input);
    } else {
      img.src = input;
    }
  });
}

/**
 * Convert file to base64
 * @param file - File object to convert
 * @returns Promise with base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Download image from URL as base64
 * @param url - Image URL to download
 * @returns Promise with base64 string
 */
export function urlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      try {
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image from URL'));
    };

    img.src = url;
  });
}

/**
 * Create a thumbnail from an image
 * @param input - File object or base64 string
 * @param size - Thumbnail size (width and height)
 * @returns Promise with thumbnail base64 data
 */
export function createThumbnail(input: File | string, size: number = 150): Promise<string> {
  return processImage(input, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7,
    format: 'image/jpeg'
  });
}

/**
 * Estimate compressed file size
 * @param base64Data - Base64 image data
 * @returns Estimated size in bytes
 */
export function estimateImageSize(base64Data: string): number {
  // Remove data URL prefix if present
  const base64Only = base64Data.split(',')[1] || base64Data;
  
  // Base64 encoding increases size by ~33%, so actual size is ~75% of base64 length
  return Math.ceil(base64Only.length * 0.75);
}

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
