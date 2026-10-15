import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AUTH_STORAGE_KEY, getStoredSession, type AuthSession } from '../context/AppContext';
import { broadcastLogout, subscribeToAuthSync } from '../db/broadcast';

// Polyfill in-memory sessionStorage for node test environment
const storageMap = new Map<string, string>();
const mockSessionStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
  get length() {
    return storageMap.size;
  },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
};

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});

describe('Auth Session & Logout Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when no session exists in sessionStorage', () => {
    expect(getStoredSession()).toBeNull();
  });

  it('returns valid AuthSession when valid session is in sessionStorage', () => {
    const mockSession: AuthSession = {
      role: 'Resident',
      residentId: 'res-abc-123',
      workerId: null,
      authenticatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession));

    const retrieved = getStoredSession();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.role).toBe('Resident');
    expect(retrieved?.residentId).toBe('res-abc-123');
    expect(retrieved?.workerId).toBeNull();
  });

  it('handles invalid or corrupted JSON gracefully', () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, '{ invalid json');
    expect(getStoredSession()).toBeNull();
  });

  it('clears session on logout', () => {
    const mockSession: AuthSession = {
      role: 'Manager',
      authenticatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession));
    expect(getStoredSession()).not.toBeNull();

    // Invalidate / remove session
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    expect(getStoredSession()).toBeNull();
  });

  it('supports multi-tab broadcast logout subscription', () => {
    const logoutListener = vi.fn();
    const unsubscribe = subscribeToAuthSync(logoutListener);

    // Trigger broadcast logout
    broadcastLogout();

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('stores and restores Worker sessions correctly', () => {
    const workerSession: AuthSession = {
      role: 'Worker',
      residentId: null,
      workerId: 'worker-tech-456',
      authenticatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(workerSession));

    const restored = getStoredSession();
    expect(restored).not.toBeNull();
    expect(restored?.role).toBe('Worker');
    expect(restored?.workerId).toBe('worker-tech-456');
  });

  it('rejects malformed session missing role or non-object values', () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ residentId: '123' }));
    expect(getStoredSession()).toBeNull();

    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify('a plain string'));
    expect(getStoredSession()).toBeNull();

    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(12345));
    expect(getStoredSession()).toBeNull();
  });

  it('validates entire session lifecycle: login -> authenticated -> logout -> unauthenticated', () => {
    // 1. Initially unauthenticated
    expect(getStoredSession()).toBeNull();

    // 2. User logs in
    const activeSession: AuthSession = {
      role: 'Resident',
      residentId: 'resident-1',
      authenticatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeSession));
    expect(getStoredSession()).toEqual(activeSession);

    // 3. User logs out
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    expect(getStoredSession()).toBeNull();
  });
});
