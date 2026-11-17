import { describe, it, expect } from 'vitest';
import {
  validateResidentName,
  validateFlatNumber,
  validateImageFile,
} from './validationUtils';
import { createCaptureSession, validateAndConsumeSession } from '../services/captureSessionService';
import type { GeoLocationData } from '../types';

describe('Resident Name Validation (validateResidentName)', () => {
  it('accepts standard Indian names with initials and multi-part words', () => {
    expect(validateResidentName('Devika R. Nair').valid).toBe(true);
    expect(validateResidentName('A. P. J. Abdul Kalam').valid).toBe(true);
    expect(validateResidentName('K. V. Ramanathan').valid).toBe(true);
    expect(validateResidentName('Mary-Ann D\'Souza').valid).toBe(true);
    expect(validateResidentName('Suresh Kumar Verma').valid).toBe(true);
  });

  it('accepts names in Indian regional Unicode scripts', () => {
    // Hindi / Devanagari
    expect(validateResidentName('राजेश शर्मा').valid).toBe(true);
    // Telugu
    expect(validateResidentName('వెంకట్ రావు').valid).toBe(true);
    // Tamil
    expect(validateResidentName('கார்த்திக் ராஜா').valid).toBe(true);
    // Malayalam
    expect(validateResidentName('അനന്യ കൃഷ്ണൻ').valid).toBe(true);
  });

  it('trims leading and trailing whitespace automatically', () => {
    const res = validateResidentName('   Sunil Sharma   ');
    expect(res.valid).toBe(true);
    expect(res.cleanValue).toBe('Sunil Sharma');
  });

  it('rejects empty or whitespace-only names', () => {
    expect(validateResidentName('').valid).toBe(false);
    expect(validateResidentName('   ').valid).toBe(false);
  });

  it('rejects single character or unreasonably short input', () => {
    expect(validateResidentName('A').valid).toBe(false);
  });

  it('rejects names with numbers or script injection attempts', () => {
    expect(validateResidentName('User123').valid).toBe(false);
    expect(validateResidentName('<script>alert(1)</script>').valid).toBe(false);
  });
});

describe('Flat Number Validation (validateFlatNumber)', () => {
  it('accepts various building, block, wing, and floor formats', () => {
    expect(validateFlatNumber('402').valid).toBe(true);
    expect(validateFlatNumber('B-204').valid).toBe(true);
    expect(validateFlatNumber('Tower A - 402').valid).toBe(true);
    expect(validateFlatNumber('Wing C - 12B').valid).toBe(true);
    expect(validateFlatNumber('Villa 14').valid).toBe(true);
    expect(validateFlatNumber('Flat 104, 1st Floor').valid).toBe(true);
    expect(validateFlatNumber('Penthouse 3').valid).toBe(true);
  });

  it('trims leading and trailing whitespace in flat numbers', () => {
    const res = validateFlatNumber('   Tower B - 501   ');
    expect(res.valid).toBe(true);
    expect(res.cleanValue).toBe('Tower B - 501');
  });

  it('rejects empty or whitespace-only flat numbers', () => {
    expect(validateFlatNumber('').valid).toBe(false);
    expect(validateFlatNumber('   ').valid).toBe(false);
  });

  it('rejects excessively long or invalid string inputs', () => {
    expect(validateFlatNumber('A'.repeat(60)).valid).toBe(false);
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
