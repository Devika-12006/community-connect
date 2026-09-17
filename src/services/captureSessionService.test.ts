import { describe, it, expect } from 'vitest';
import {
  createCaptureSession,
  getCaptureSession,
  validateAndConsumeSession,
} from './captureSessionService';
import type { GeoLocationData } from '../types';

describe('captureSessionService suite', () => {
  const validGeo: GeoLocationData = {
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 25,
    locationTimestamp: new Date().toISOString(),
    clientCaptureTimestamp: new Date().toISOString(),
  };

  // Helper valid JPEG blob
  const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validBlob = new Blob([validJpegBytes], { type: 'image/jpeg' });

  it('creates an authoritative short-lived capture session', () => {
    const session = createCaptureSession({
      userId: 'res-123',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-999',
    });

    expect(session.id).toBeDefined();
    expect(session.token).toMatch(/^cs_/);
    expect(session.isConsumed).toBe(false);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('validates and atomically consumes an active session', async () => {
    const session = createCaptureSession({
      userId: 'res-123',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-999',
    });

    const result = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-123',
      role: 'Resident',
      draftId: 'draft-999',
      imageBlob: validBlob,
      geoData: validGeo,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.sessionId).toBe(session.id);
      expect(result.imageHash).toBeDefined();
    }

    const updatedSession = getCaptureSession(session.id);
    expect(updatedSession?.isConsumed).toBe(true);
  });

  it('rejects replay consumption of an already-consumed session', async () => {
    const session = createCaptureSession({
      userId: 'res-123',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-999',
    });

    // First consumption: Success
    const firstResult = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-123',
      role: 'Resident',
      draftId: 'draft-999',
      imageBlob: validBlob,
      geoData: validGeo,
    });
    expect(firstResult.valid).toBe(true);

    // Replay attempt: Rejected
    const replayResult = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-123',
      role: 'Resident',
      draftId: 'draft-999',
      imageBlob: validBlob,
      geoData: validGeo,
    });
    expect(replayResult.valid).toBe(false);
    if (!replayResult.valid) {
      expect(replayResult.error).toContain('already been consumed');
    }
  });

  it('rejects consumption with incorrect ownership or draft binding', async () => {
    const session = createCaptureSession({
      userId: 'res-123',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-999',
    });

    // Wrong user
    const wrongUser = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-DIFFERENT',
      role: 'Resident',
      draftId: 'draft-999',
      imageBlob: validBlob,
      geoData: validGeo,
    });
    expect(wrongUser.valid).toBe(false);
    if (!wrongUser.valid) {
      expect(wrongUser.error).toContain('ownership mismatch');
    }

    // Wrong draft
    const wrongDraft = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-123',
      role: 'Resident',
      draftId: 'draft-DIFFERENT',
      imageBlob: validBlob,
      geoData: validGeo,
    });
    expect(wrongDraft.valid).toBe(false);
    if (!wrongDraft.valid) {
      expect(wrongDraft.error).toContain('bound to a different report');
    }
  });

  it('rejects invalid or poor-accuracy GPS coordinates', async () => {
    const session = createCaptureSession({
      userId: 'res-123',
      role: 'Resident',
      communityId: 'comm-1',
      draftType: 'complaint',
      draftId: 'draft-999',
    });

    // Out of bounds coordinates
    const invalidCoords = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-123',
      role: 'Resident',
      draftId: 'draft-999',
      imageBlob: validBlob,
      geoData: { ...validGeo, latitude: 120 }, // invalid lat
    });
    expect(invalidCoords.valid).toBe(false);

    // Terrible accuracy (e.g. 500m)
    const badAccuracy = await validateAndConsumeSession({
      sessionId: session.id,
      token: session.token,
      userId: 'res-123',
      role: 'Resident',
      draftId: 'draft-999',
      imageBlob: validBlob,
      geoData: { ...validGeo, accuracy: 600 },
    });
    expect(badAccuracy.valid).toBe(false);
    if (!badAccuracy.valid) {
      expect(badAccuracy.error).toContain('GPS accuracy');
    }
  });
});
