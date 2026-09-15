export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file format "${file.type || 'unknown'}". Only JPG, PNG, and WebP are accepted.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB.`,
    };
  }

  // Verify that the image can be decoded
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
