import { describe, it, expect } from 'vitest';
import {
  validateResidentName,
  validateFlatNumber,
  validateImageFile,
} from './validationUtils';
import { createCaptureSession, validateAndConsumeSession } from '../services/captureSessionService';
import type { GeoLocationData } from '../types';

describe('Resident Name Validation (validateResidentName)', () => {
  it('accepts valid English names with spaces up to 30 characters', () => {
    expect(validateResidentName('Devika Nair').valid).toBe(true);
    expect(validateResidentName('Priya Sharma').valid).toBe(true);
    expect(validateResidentName('John Doe').valid).toBe(true);
    expect(validateResidentName('Alexander Pierce').valid).toBe(true);
    expect(validateResidentName('A').valid).toBe(true);
    // Exactly 30 characters
    expect(validateResidentName('Abcdefghij Abcdefghij Abcdefgh').valid).toBe(true);
  });

  it('trims unnecessary leading, trailing, and multiple spaces before saving', () => {
    const res1 = validateResidentName('   Sunil Sharma   ');
    expect(res1.valid).toBe(true);
    expect(res1.cleanValue).toBe('Sunil Sharma');

    const res2 = validateResidentName('Devika    Nair');
    expect(res2.valid).toBe(true);
    expect(res2.cleanValue).toBe('Devika Nair');
  });

  it('rejects empty or whitespace-only names as mandatory field', () => {
    expect(validateResidentName('').valid).toBe(false);
    expect(validateResidentName('').error).toContain('mandatory');
    expect(validateResidentName('   ').valid).toBe(false);
    expect(validateResidentName(null).valid).toBe(false);
    expect(validateResidentName(undefined).valid).toBe(false);
  });

  it('rejects names exceeding 30 characters', () => {
    const over30 = 'A'.repeat(31);
    const res = validateResidentName(over30);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('30 characters');
  });

  it('rejects names containing numbers or special characters', () => {
    expect(validateResidentName('Devika123').valid).toBe(false);
    expect(validateResidentName('Mary-Ann').valid).toBe(false); // No hyphens
    expect(validateResidentName('Devika R. Nair').valid).toBe(false); // No periods
    expect(validateResidentName('Devika@home').valid).toBe(false);
    expect(validateResidentName('<script>alert(1)</script>').valid).toBe(false);
    // Non-English letters
    expect(validateResidentName('राजेश शर्मा').valid).toBe(false);
  });
});

describe('Flat Number Validation (validateFlatNumber)', () => {
  it('accepts letters, numbers, hyphens, and forward slashes up to 10 characters', () => {
    // Prompt examples
    expect(validateFlatNumber('A-203').valid).toBe(true);
    expect(validateFlatNumber('B/102').valid).toBe(true);
    expect(validateFlatNumber('1204').valid).toBe(true);

    // Other valid formats
    expect(validateFlatNumber('302').valid).toBe(true);
    expect(validateFlatNumber('C-12/A').valid).toBe(true);
    expect(validateFlatNumber('FLAT-1').valid).toBe(true);
    // Exactly 10 characters
    expect(validateFlatNumber('A123456789').valid).toBe(true);
    expect(validateFlatNumber('AB-12/34-X').valid).toBe(true);
  });

  it('trims leading and trailing whitespace in flat numbers', () => {
    const res = validateFlatNumber('   A-203   ');
    expect(res.valid).toBe(true);
    expect(res.cleanValue).toBe('A-203');
  });

  it('rejects empty or whitespace-only flat numbers as mandatory field', () => {
    expect(validateFlatNumber('').valid).toBe(false);
    expect(validateFlatNumber('').error).toContain('mandatory');
    expect(validateFlatNumber('   ').valid).toBe(false);
    expect(validateFlatNumber(null).valid).toBe(false);
    expect(validateFlatNumber(undefined).valid).toBe(false);
  });

  it('rejects flat numbers exceeding 10 characters', () => {
    const over10 = '12345678901';
    const res = validateFlatNumber(over10);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('10 characters');
  });

  it('rejects spaces and other special characters in flat numbers', () => {
    expect(validateFlatNumber('A 203').valid).toBe(false); // Spaces not allowed
    expect(validateFlatNumber('Tower A - 402').valid).toBe(false); // Spaces not allowed
    expect(validateFlatNumber('B#102').valid).toBe(false); // Hash not allowed
    expect(validateFlatNumber('Flat.101').valid).toBe(false); // Period not allowed
    expect(validateFlatNumber('A@203').valid).toBe(false); // @ not allowed
    expect(validateFlatNumber('Villa, 14').valid).toBe(false); // Comma not allowed
  });
});

describe('Gallery & Camera Image Validation (validateImageFile)', () => {
  it('accepts JPEG, PNG, and WebP files under 5MB', () => {
    const mockJpg = new File(['mock content'], 'issue.jpg', { type: 'image/jpeg' });
    const mockPng = new File(['mock content'], 'evidence.png', { type: 'image/png' });
    const mockWebp = new File(['mock content'], 'photo.webp', { type: 'image/webp' });

    expect(validateImageFile(mockJpg).valid).toBe(true);
    expect(validateImageFile(mockPng).valid).toBe(true);
    expect(validateImageFile(mockWebp).valid).toBe(true);
  });

  it('rejects files larger than 5MB', () => {
    // 6MB buffer simulation
    const largeBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' });
    const largeFile = new File([largeBlob], 'oversized.jpg', { type: 'image/jpeg' });

    const result = validateImageFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5 MB');
  });

  it('rejects non-image file types', () => {
    const textFile = new File(['some text'], 'notes.txt', { type: 'text/plain' });
    const pdfFile = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });
    const videoFile = new File(['mp4 data'], 'clip.mp4', { type: 'video/mp4' });

    expect(validateImageFile(textFile).valid).toBe(false);
    expect(validateImageFile(pdfFile).valid).toBe(false);
    expect(validateImageFile(videoFile).valid).toBe(false);
  });
});

describe('Camera Capture & Session with Optional GPS', () => {
  const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validBlob = new Blob([validJpegBytes], { type: 'image/jpeg' });

  it('validates a session successfully with GPS coordinates', async () => {
    const session = createCaptureSession({
      userId: 'res-test-1',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-101',
    });

    const geoData: GeoLocationData = {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      locationTimestamp: new Date().toISOString(),
      clientCaptureTimestamp: new Date().toISOString(),
    };

    const res = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-test-1',
      role: 'Resident',
      draftId: 'draft-101',
      imageBlob: validBlob,
      geoData,
    });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.sessionId).toBe(session.id);
      expect(res.imageHash).toBeDefined();
    }
  });

  it('validates a session successfully WITHOUT GPS coordinates (optional GPS)', async () => {
    const session = createCaptureSession({
      userId: 'res-test-2',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-102',
    });

    // GPS is undefined (optional GPS)
    const res = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-test-2',
      role: 'Resident',
      draftId: 'draft-102',
      imageBlob: validBlob,
      geoData: undefined,
    });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.sessionId).toBe(session.id);
      expect(res.imageHash).toBeDefined();
      expect(res.geo).toBeUndefined();
    }
  });

  it('prevents replay attack when token is consumed twice', async () => {
    const session = createCaptureSession({
      userId: 'res-test-3',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-103',
    });

    const firstCheck = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-test-3',
      role: 'Resident',
      draftId: 'draft-103',
      imageBlob: validBlob,
    });
    expect(firstCheck.valid).toBe(true);

    const secondCheck = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-test-3',
      role: 'Resident',
      draftId: 'draft-103',
      imageBlob: validBlob,
    });
    expect(secondCheck.valid).toBe(false);
    if (!secondCheck.valid) {
      expect(secondCheck.error).toContain('already been consumed');
    }
  });
});
