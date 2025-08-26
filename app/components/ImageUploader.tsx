import { useState, useRef, useCallback } from "react";
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Center,
  Image,
  Modal,
  Progress,
  Alert,
  Box,
  FileInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCamera,
  IconUpload,
  IconX,
  IconCheck,
  IconExclamationMark,
  IconPhoto,
} from "@tabler/icons-react";
import { useImageUpload } from "~/hooks/useImageUpload";

export interface ImageUploaderProps {
  value?: string | null;
  onChange?: (imageUrl: string | null) => void;
  folder?: string;
  userId?: string;
  processType?: 'profile' | 'room' | 'custom';
  showCamera?: boolean;
  showFileUpload?: boolean;
  maxSize?: number;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
}

// Camera component for capturing photos
function CameraCapture({ onCapture, onClose }: { onCapture: (imageData: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 480 },
          height: { ideal: 640 },
          facingMode: 'user' 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageData);
        stopCamera();
        onClose();
      }
    }
  }, [onCapture, onClose, stopCamera]);

  useState(() => {
    startCamera();
    return () => stopCamera();
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" ta="center">
        Position yourself in the center and ensure good lighting for a clear photo
      </Text>
      
      <Box style={{ position: 'relative', maxWidth: 400, margin: '0 auto' }}>
        <Box
          component="video"
          ref={videoRef}
          autoPlay
          playsInline
          muted
          w="100%"
          h="auto"
          style={{ borderRadius: 8, border: '2px solid var(--mantine-color-blue-5)' }}
        />
        <Box component="canvas" ref={canvasRef} display="none" />
      </Box>

      <Group justify="center" gap="md">
        <Button
          leftSection={<IconCamera size={16} />}
          onClick={capturePhoto}
          disabled={!isStreaming}
          size="lg"
        >
          Capture Photo
        </Button>
        
        <Button
          variant="outline"
          leftSection={<IconX size={16} />}
          onClick={() => {
            stopCamera();
            onClose();
          }}
          size="lg"
        >
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

export function ImageUploader({
  value,
  onChange,
  folder = 'uploads',
  userId,
  processType = 'custom',
  showCamera = true,
  showFileUpload = true,
  maxSize = 5 * 1024 * 1024, // 5MB
  title = "Upload Image",
  description,
  width = 300,
  height = 200,
  placeholder = "No image selected",
  disabled = false,
}: ImageUploaderProps) {
  const [cameraOpened, { open: openCamera, close: closeCamera }] = useDisclosure(false);
  const [localImage, setLocalImage] = useState(value);

  const {
    isUploading,
    uploadProgress,
    error,
    uploadImage,
    uploadBase64,
    deleteImage: deleteImageFromStorage,
    reset: resetUpload
  } = useImageUpload({
    folder,
    userId,
    maxSize,
    processType,
    onSuccess: (url) => {
      setLocalImage(url);
      onChange?.(url);
    },
    onError: () => {
      // Error is handled by the hook
    }
  });

  const handleFileUpload = async (file: File | null) => {
    if (file && !disabled) {
      await uploadImage(file);
    }
  };

  const handleCameraCapture = async (imageData: string) => {
    if (!disabled) {
      const fileName = `camera_${Date.now()}.jpg`;
      await uploadBase64(imageData, fileName);
    }
  };

  const handleRemoveImage = async () => {
    if (localImage && !disabled) {
      try {
        await deleteImageFromStorage(localImage);
        setLocalImage(null);
        onChange?.(null);
      } catch (error) {
        console.error('Failed to delete image:', error);
      }
    }
  };

  const clearError = () => {
    resetUpload();
  };

  return (
    <Card withBorder>
      <Stack gap="md">
        <Text fw={500}>{title}</Text>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <Stack gap="xs">
            <Text size="sm">Uploading...</Text>
            <Progress value={uploadProgress} size="sm" animated />
          </Stack>
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconExclamationMark size={16} />}
            title="Upload Error"
            color="red"
            variant="light"
            withCloseButton
            onClose={clearError}
          >
            {error}
          </Alert>
        )}

        {/* Image Preview */}
        {localImage ? (
          <Group gap="md" align="flex-start">
            <Center>
              <Image
                src={localImage}
                alt="Uploaded image"
                w={Math.min(width, 200)}
                h={Math.min(height, 200)}
                fit="cover"
                radius="md"
                style={{ border: '2px solid var(--mantine-color-gray-3)' }}
              />
            </Center>
            <Stack gap="xs">
              <Text size="sm" c="green">
                <IconCheck size={16} style={{ display: 'inline', marginRight: 4 }} />
                Image uploaded successfully
              </Text>
              {showCamera && (
                <Button
                  variant="outline"
                  leftSection={<IconCamera size={16} />}
                  onClick={openCamera}
                  size="sm"
                  disabled={disabled || isUploading}
                >
                  Retake Photo
                </Button>
              )}
              <Button
                variant="outline"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={handleRemoveImage}
                size="sm"
                disabled={disabled || isUploading}
              >
                Remove Image
              </Button>
            </Stack>
          </Group>
        ) : (
          <Stack gap="md">
            <Center
              style={{
                border: '2px dashed var(--mantine-color-gray-4)',
                borderRadius: 8,
                padding: '2rem',
                minHeight: Math.min(height, 150),
              }}
            >
              <Stack gap="sm" align="center">
                <IconPhoto size={48} color="var(--mantine-color-gray-5)" />
                <Text c="dimmed" size="sm">
                  {placeholder}
                </Text>
              </Stack>
            </Center>

            <Group gap="md" justify="center">
              {showCamera && (
                <Tooltip label="Take a photo with your camera">
                  <Button
                    leftSection={<IconCamera size={16} />}
                    onClick={openCamera}
                    variant="light"
                    disabled={disabled || isUploading}
                  >
                    Take Photo
                  </Button>
                </Tooltip>
              )}
              
              {showFileUpload && (
                <>
                  {showCamera && <Text c="dimmed" size="sm">or</Text>}
                  
                  <Tooltip label="Upload an image from your device">
                    <FileInput
                      placeholder="Upload from device"
                      leftSection={<IconUpload size={16} />}
                      accept="image/*"
                      onChange={handleFileUpload}
                      variant="light"
                      disabled={disabled || isUploading}
                    />
                  </Tooltip>
                </>
              )}
            </Group>
          </Stack>
        )}
      </Stack>

      {/* Camera Modal */}
      <Modal
        opened={cameraOpened}
        onClose={closeCamera}
        title="Take Photo"
        size="lg"
        centered
      >
        <CameraCapture onCapture={handleCameraCapture} onClose={closeCamera} />
      </Modal>
    </Card>
  );
}

// Specific variants for common use cases
export function ProfilePictureUploader({ userId, ...props }: Omit<ImageUploaderProps, 'processType' | 'folder'> & { userId: string }) {
  return (
    <ImageUploader
      {...props}
      processType="profile"
      folder="profile-pictures"
      userId={userId}
      title={props.title || "Profile Picture"}
      description={props.description || "Upload a passport-style photo for identification"}
      width={150}
      height={200}
    />
  );
}

export function RoomImageUploader({ ...props }: Omit<ImageUploaderProps, 'processType' | 'folder'>) {
  return (
    <ImageUploader
      {...props}
      processType="room"
      folder="room-images"
      title={props.title || "Room Image"}
      description={props.description || "Upload high-quality images of the room"}
      width={400}
      height={300}
    />
  );
}
