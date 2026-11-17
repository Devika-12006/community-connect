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
 * Validates complete first, middle, last, and multi-part names.
 * Supports Unicode, Indian-language scripts (Devanagari, Telugu, Tamil, Malayalam, Bengali, etc.),
 * periods for initials, hyphens, and apostrophes.
 * Rejects empty input, purely numerical/special characters, and inappropriate markup.
 */
export function validateResidentName(rawName: string | undefined | null): ValidationResult {
  if (!rawName) {
    return { valid: false, error: 'Resident name is required.' };
  }

  const cleanName = rawName.trim();
  if (cleanName.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters long.' };
  }

  if (cleanName.length > 120) {
    return { valid: false, error: 'Name cannot exceed 120 characters.' };
  }

  // Unicode letter & mark matching with spaces, dots, hyphens, and apostrophes
  // \p{L} matches any Unicode letter, \p{M} matches vowel/accent marks (e.g. in Indian scripts)
  const unicodeNameRegex = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{0,118}[\p{L}\p{M}.']$/u;

  if (!unicodeNameRegex.test(cleanName)) {
    return {
      valid: false,
      error: 'Please enter a valid name containing letters, initials, or legitimate name punctuation.',
    };
  }

  // Reject script or html tags
  if (/<[^>]*>/i.test(cleanName)) {
    return { valid: false, error: 'Name contains invalid characters.' };
  }

  return { valid: true, cleanValue: cleanName };
}

/**
 * Validates flat, apartment, villa, and unit identifiers.
 * Supports multiple buildings, blocks, wings, floors, and flat formats:
 * e.g. "402", "B-204", "Tower A - 402", "Wing C - 12B", "Villa 14", "Flat 104, 1st Floor", "Penthouse 1"
 */
export function validateFlatNumber(rawFlat: string | undefined | null): ValidationResult {
  if (!rawFlat) {
    return { valid: false, error: 'Flat or unit number is required.' };
  }

  const cleanFlat = rawFlat.trim();
  if (cleanFlat.length < 1) {
    return { valid: false, error: 'Flat or unit number cannot be empty.' };
  }

  if (cleanFlat.length > 50) {
    return { valid: false, error: 'Flat number cannot exceed 50 characters.' };
  }

  // Flexible pattern supporting alphanumeric, hyphens, slashes, commas, and common unit punctuation
  const flatRegex = /^[a-zA-Z0-9\s/.,#-]{1,50}$/;
  if (!flatRegex.test(cleanFlat)) {
    return {
      valid: false,
      error: 'Please enter a valid flat or unit number (letters, numbers, hyphens, or slashes).',
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
