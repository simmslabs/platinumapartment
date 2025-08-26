import { useState } from "react";
import { processProfilePicture, processRoomImage, validateImageFile } from "~/utils/image.client";

export interface UseImageUploadOptions {
  folder?: string;
  userId?: string;
  maxSize?: number;
  onSuccess?: (url: string) => void;
  onError?: (error: string) => void;
  processType?: 'profile' | 'room' | 'custom';
}

export interface UseImageUploadReturn {
  isUploading: boolean;
  uploadProgress: number;
  uploadedUrl: string | null;
  error: string | null;
  uploadImage: (file: File) => Promise<void>;
  uploadBase64: (base64Data: string, fileName: string) => Promise<void>;
  deleteImage: (url: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for handling image uploads with R2 integration
 */
export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const {
    folder = 'uploads',
    userId,
    maxSize = 5 * 1024 * 1024, // 5MB default
    onSuccess,
    onError,
    processType = 'custom'
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadedUrl(null);
    setError(null);
  };

  const uploadImage = async (file: File): Promise<void> => {
    reset();
    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Validate file
      const validation = validateImageFile(file, maxSize);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setUploadProgress(30);

      // Process image based on type
      let processedImageData: string;
      switch (processType) {
        case 'profile':
          processedImageData = await processProfilePicture(file);
          break;
        case 'room':
          processedImageData = await processRoomImage(file);
          break;
        default:
          // Convert to base64 without processing
          processedImageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
      }

      setUploadProgress(60);

      // Upload to server
      const formData = new FormData();
      formData.append('intent', 'upload');
      formData.append('imageData', processedImageData);
      formData.append('fileName', file.name);
      formData.append('folder', folder);
      if (userId) formData.append('userId', userId);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData
      });

      setUploadProgress(90);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadedUrl(result.url);
      onSuccess?.(result.url);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadBase64 = async (base64Data: string, fileName: string): Promise<void> => {
    reset();
    setIsUploading(true);
    setUploadProgress(20);

    try {
      // Upload to server
      const formData = new FormData();
      formData.append('intent', 'upload');
      formData.append('imageData', base64Data);
      formData.append('fileName', fileName);
      formData.append('folder', folder);
      if (userId) formData.append('userId', userId);

      setUploadProgress(60);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData
      });

      setUploadProgress(90);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadedUrl(result.url);
      onSuccess?.(result.url);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImage = async (url: string): Promise<void> => {
    try {
      const formData = new FormData();
      formData.append('intent', 'delete');
      formData.append('imageUrl', url);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }

      if (uploadedUrl === url) {
        setUploadedUrl(null);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  return {
    isUploading,
    uploadProgress,
    uploadedUrl,
    error,
    uploadImage,
    uploadBase64,
    deleteImage,
    reset
  };
}

/**
 * Hook specifically for profile picture uploads
 */
export function useProfilePictureUpload(userId: string, options: Omit<UseImageUploadOptions, 'processType' | 'folder'> = {}) {
  return useImageUpload({
    ...options,
    folder: 'profile-pictures',
    userId,
    processType: 'profile'
  });
}

/**
 * Hook specifically for room image uploads
 */
export function useRoomImageUpload(options: Omit<UseImageUploadOptions, 'processType' | 'folder'> = {}) {
  return useImageUpload({
    ...options,
    folder: 'room-images',
    processType: 'room'
  });
}
