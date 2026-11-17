import type {
  CaptureSession,
  GeoLocationData,
  RoleType,
} from '../types';
import { isValidCoordinate, isLocationFresh } from '../lib/geoUtils';
import { validateImageBytes } from '../lib/imageVerification';

/**
 * In-memory authoritative session store.
 * Tracks short-lived capture sessions, preventing replay, transfer, or reuse.
 */
const activeSessions = new Map<string, CaptureSession>();

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes validity
const MAX_LOCATION_AGE_SECONDS = 120; // Maximum allowed age for GPS reading (2 minutes)
const MAX_ALLOWED_ACCURACY_METERS = 250; // Maximum acceptable GPS accuracy radius

export interface CreateSessionParams {
  userId: string;
  role: RoleType;
  communityId: string;
  draftType: 'complaint' | 'worker_completion';
  draftId: string;
}

export interface ValidationSuccessReceipt {
  valid: true;
  sessionId: string;
  imageHash: string;
  serverReceivedTimestamp: string;
  geo?: GeoLocationData;
}

export interface ValidationFailureReceipt {
  valid: false;
  error: string;
}

export type SessionValidationReceipt = ValidationSuccessReceipt | ValidationFailureReceipt;

/**
 * Creates an authenticated, short-lived capture session tied to user, role, and draft.
 */
export function createCaptureSession(params: CreateSessionParams): CaptureSession {
  const id = crypto.randomUUID();
  const token = `cs_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();

  const session: CaptureSession = {
    id,
    token,
    userId: params.userId,
    role: params.role,
    communityId: params.communityId,
    draftType: params.draftType,
    draftId: params.draftId,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    isConsumed: false,
  };

  activeSessions.set(id, session);
  return session;
}

/**
 * Retrieves a session by ID.
 */
export function getCaptureSession(sessionId: string): CaptureSession | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * Validates and atomically consumes a capture session.
 * Enforces session ownership, expiry, replay protection, coordinate bounds, and image integrity.
 *
 * NOTE: This validates the capture workflow lifecycle and single-use session tokens;
 * it cannot prove that raw image bytes originated from a physical camera sensor on an untrusted client device.
 */
export async function validateAndConsumeSession(params: {
  sessionId: string;
  token?: string;
  userId: string;
  role: RoleType;
  draftId: string;
  imageBlob: Blob;
  geoData?: GeoLocationData;
}): Promise<SessionValidationReceipt> {
  const { sessionId, token, userId, role, draftId, imageBlob, geoData } = params;

  // 1. Session lookup
  const session = activeSessions.get(sessionId);
  if (!session) {
    return {
      valid: false,
      error: 'Capture session not found. Live camera capture must be initiated through the application.',
    };
  }

  // 2. Token verification (if token was supplied)
  if (token && session.token !== token) {
    return {
      valid: false,
      error: 'Invalid capture session credentials.',
    };
  }

  // 3. Single-use / replay protection check
  if (session.isConsumed) {
    return {
      valid: false,
      error: 'This capture session has already been consumed. Replay or photo reuse is not permitted.',
    };
  }

  // 4. Session expiration check
  const nowMs = Date.now();
  const expiryMs = new Date(session.expiresAt).getTime();
  if (nowMs > expiryMs) {
    return {
      valid: false,
      error: 'Capture session has expired. Please open the camera and take a fresh photo.',
    };
  }

  // 5. Ownership and task binding verification
  if (session.userId !== userId || session.role !== role) {
    return {
      valid: false,
      error: 'Session ownership mismatch. Capture session does not belong to the active user.',
    };
  }

  if (session.draftId !== draftId) {
    return {
      valid: false,
      error: 'Capture session is bound to a different report or task. Cross-task attachment is prohibited.',
    };
  }

  // 6. Optional Geolocation coordinate validation (only checked if GPS was acquired)
  if (geoData) {
    if (!isValidCoordinate(geoData.latitude, geoData.longitude)) {
      return {
        valid: false,
        error: `Invalid GPS coordinates (${geoData.latitude}, ${geoData.longitude}). Latitude must be between -90 and 90, longitude between -180 and 180.`,
      };
    }

    if (typeof geoData.accuracy === 'number' && (geoData.accuracy <= 0 || geoData.accuracy > MAX_ALLOWED_ACCURACY_METERS)) {
      return {
        valid: false,
        error: `GPS accuracy (±${Math.round(geoData.accuracy)}m) is insufficient. Accuracy must be under ${MAX_ALLOWED_ACCURACY_METERS}m.`,
      };
    }

    if (geoData.locationTimestamp && !isLocationFresh(geoData.locationTimestamp, MAX_LOCATION_AGE_SECONDS, nowMs)) {
      return {
        valid: false,
        error: 'Stale location reading rejected. A fresh GPS location is required at time of capture.',
      };
    }
  }

  // 7. Image binary magic bytes and size validation
  const imageCheck = await validateImageBytes(imageBlob);
  if (!imageCheck.valid) {
    return {
      valid: false,
      error: imageCheck.error || 'Corrupt or disguised image file.',
    };
  }

  // 8. Compute authoritative SHA-256 digest
  let imageHash = '';
  try {
    const buffer = await imageBlob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    imageHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    imageHash = `hash-${imageBlob.size}-${nowMs}`;
  }

  // 9. Atomic consumption
  const serverReceivedTimestamp = new Date(nowMs).toISOString();
  session.isConsumed = true;
  session.consumedAt = serverReceivedTimestamp;
  session.consumedWithImageHash = imageHash;

  return {
    valid: true,
    sessionId: session.id,
    imageHash,
    serverReceivedTimestamp,
    geo: geoData
      ? {
          ...geoData,
          serverReceivedTimestamp,
        }
      : undefined,
  };
}

/**
 * Resets or clears expired sessions (maintenance utility).
 */
export function pruneExpiredSessions(): number {
  const now = Date.now();
  let pruned = 0;
  for (const [id, session] of activeSessions.entries()) {
    if (now > new Date(session.expiresAt).getTime() + 60000) {
      activeSessions.delete(id);
      pruned++;
    }
  }
  return pruned;
}
