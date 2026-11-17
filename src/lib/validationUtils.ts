/**
 * Validation utilities for resident details, flat numbers, and file uploads.
 * Complies with Community Connect privacy, Unicode naming, and flexible community layouts.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  cleanValue?: string;
}

/**
 * Validates resident name according to community standards.
 * Requirements:
 * - Mandatory field.
 * - Allow a maximum of 30 characters.
 * - Accept only English alphabets (A–Z, a–z) and spaces.
 * - Do not allow numbers or special characters.
 * - Trims unnecessary spaces (leading, trailing, and collapses consecutive spaces).
 */
export function validateResidentName(rawName: string | undefined | null): ValidationResult {
  if (rawName === undefined || rawName === null) {
    return { valid: false, error: 'Name is mandatory.' };
  }

  // Trim unnecessary spaces (leading, trailing)
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Name is mandatory.' };
  }

  if (trimmed.length > 30) {
    return { valid: false, error: 'Name cannot exceed 30 characters.' };
  }

  // Accept only English alphabets (A–Z, a–z) and spaces. Numbers and special characters are not allowed.
  const englishAlphaWithSpaces = /^[A-Za-z ]+$/;
  if (!englishAlphaWithSpaces.test(trimmed)) {
    return {
      valid: false,
      error: 'Name must contain only English alphabets and spaces. Numbers and special characters are not allowed.',
    };
  }

  // Clean value collapses multiple consecutive spaces to a single space
  const cleanName = trimmed.replace(/\s+/g, ' ');
  if (cleanName.length > 30) {
    return { valid: false, error: 'Name cannot exceed 30 characters.' };
  }

  return { valid: true, cleanValue: cleanName };
}

/**
 * Validates flat / unit number.
 * Requirements:
 * - Mandatory field.
 * - Allow a maximum of 10 characters.
 * - Accept only letters, numbers, hyphens (-), and forward slashes (/).
 *   Examples: A-203, B/102, 1204.
 * - Do not allow other special characters or spaces.
 */
export function validateFlatNumber(rawFlat: string | undefined | null): ValidationResult {
  if (rawFlat === undefined || rawFlat === null) {
    return { valid: false, error: 'Flat number is mandatory.' };
  }

  const cleanFlat = rawFlat.trim();
  if (cleanFlat.length === 0) {
    return { valid: false, error: 'Flat number is mandatory.' };
  }

  if (cleanFlat.length > 10) {
    return { valid: false, error: 'Flat number cannot exceed 10 characters.' };
  }

  // Accept only letters, numbers, hyphens (-), and forward slashes (/).
  // No spaces or other special characters allowed.
  const flatRegex = /^[A-Za-z0-9/-]+$/;
  if (!flatRegex.test(cleanFlat)) {
    return {
      valid: false,
      error: 'Flat number can only contain letters, numbers, hyphens (-), and forward slashes (/). Spaces and other special characters are not allowed.',
    };
  }

  return { valid: true, cleanValue: cleanFlat };
}

/**
 * Validates gallery/camera image upload format and file size.
 * Allowed formats: JPEG, PNG, WebP. Maximum size: 5MB per image.
 */
export function validateImageFile(file: File | Blob): ValidationResult {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  const type = file.type?.toLowerCase();
  if (type && !allowedMimeTypes.includes(type)) {
    return {
      valid: false,
      error: 'Unsupported image format. Please select a JPG, PNG, or WebP photograph.',
    };
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image size (${sizeMb} MB) exceeds the 5 MB limit. Please choose a smaller photograph.`,
    };
  }

  return { valid: true };
}
