import { validateImageBytes } from './imageVerification';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  // 1. Verify binary magic bytes and file size
  const byteCheck = await validateImageBytes(file);
  if (!byteCheck.valid) {
    return {
      valid: false,
      error: byteCheck.error,
    };
  }

  // 2. Verify that the image can be decoded
  try {
    const isValidImage = await new Promise<boolean>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      img.src = url;
    });

    if (!isValidImage) {
      return {
        valid: false,
        error: 'Corrupted image file or unable to decode image.',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Failed to inspect image contents.',
    };
  }

  return { valid: true };
}
