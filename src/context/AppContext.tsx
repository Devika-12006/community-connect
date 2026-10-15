import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { repository } from '../db/repository';
import { subscribeToSync, initBroadcastSync, subscribeToAuthSync, broadcastLogout } from '../db/broadcast';
import {
  DEFAULT_SETTINGS,
  type CommunitySettings,
  type Resident,
  type Worker,
  type Complaint,
  type Notification,
  type RoleType,
} from '../types';

export interface AuthSession {
  role: RoleType;
  residentId?: string | null;
  workerId?: string | null;
  authenticatedAt: string;
}

export const AUTH_STORAGE_KEY = 'cc_auth_session';

export function getStoredSession(): AuthSession | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.role) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

interface AppContextValue {
  settings: CommunitySettings;
  residents: Resident[];
  workers: Worker[];
  complaints: Complaint[];
  notifications: Notification[];
  unreadNotificationCount: number;
  currentRole: RoleType;
  activeResident: Resident | null;
  activeWorker: Worker | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (role: RoleType, residentId?: string, workerId?: string) => void;
  logout: () => void;
  setRole: (role: RoleType, residentId?: string, workerId?: string) => void;
  createResident: (displayName: string, block: string, flatNumber: string) => Promise<Resident>;
  createWorker: (name: string, specialty: string, contactNumber?: string) => Promise<Worker>;
  updateWorker: (worker: Worker) => Promise<void>;
  updateSettings: (settings: CommunitySettings) => Promise<void>;
  refreshAll: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  resetPrototypeData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSession = getStoredSession();
  const [settings, setSettings] = useState<CommunitySettings>(DEFAULT_SETTINGS);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialSession);
  const [currentRole, setCurrentRoleState] = useState<RoleType>(initialSession?.role || 'Resident');
  const [activeResidentId, setActiveResidentId] = useState<string | null>(initialSession?.residentId || null);
  const [activeWorkerId, setActiveWorkerId] = useState<string | null>(initialSession?.workerId || null);
  const [loading, setLoading] = useState(true);

  // Initialize broadcast channel for tab synchronization
  useEffect(() => {
    initBroadcastSync();
  }, []);

  // Listen to multi-tab logout events
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthSync(() => {
      setIsAuthenticated(false);
      setActiveResidentId(null);
      setActiveWorkerId(null);
      setNotifications([]);
      try {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {}
    });
    return () => unsubscribeAuth();
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [st, rList, wList, cList] = await Promise.all([
        repository.getSettings(),
        repository.getResidents(),
        repository.getWorkers(),
        repository.getComplaints(),
      ]);

      setSettings(st);
      setResidents(rList);
      setWorkers(wList);
      setComplaints(cList);

      const session = getStoredSession();
      if (session) {
        setIsAuthenticated(true);
        setCurrentRoleState(session.role);

        // Preserve or set active resident
        if (session.role === 'Resident') {
          setActiveResidentId((prev) => {
            const candidate = session.residentId || prev;
            if (candidate && rList.some((r) => r.id === candidate && r.active)) return candidate;
            const firstActive = rList.find((r) => r.active);
            const chosen = firstActive ? firstActive.id : null;
            if (chosen !== session.residentId) {
              session.residentId = chosen;
              try {
                sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
              } catch {}
            }
            return chosen;
          });
        }

        // Preserve or set active worker
        if (session.role === 'Worker') {
          setActiveWorkerId((prev) => {
            const candidate = session.workerId || prev;
            if (candidate && wList.some((w) => w.id === candidate && w.active)) return candidate;
            const firstActive = wList.find((w) => w.active);
            const chosen = firstActive ? firstActive.id : null;
            if (chosen !== session.workerId) {
              session.workerId = chosen;
              try {
                sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
              } catch {}
            }
            return chosen;
          });
        }
      } else {
        setIsAuthenticated(false);
        setActiveResidentId(null);
        setActiveWorkerId(null);
      }
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications for the current active role & actor
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    let recipientId: string | undefined = undefined;
    if (currentRole === 'Resident' && activeResidentId) {
      recipientId = activeResidentId;
    } else if (currentRole === 'Worker' && activeWorkerId) {
      recipientId = activeWorkerId;
    }

    try {
      const notifs = await repository.getNotifications(currentRole, recipientId);
      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [isAuthenticated, currentRole, activeResidentId, activeWorkerId]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Listen to multi-tab sync
  useEffect(() => {
    const unsubscribe = subscribeToSync(() => {
      refreshAll();
    });
    return () => unsubscribe();
  }, [refreshAll]);

  // Refresh notifications when role or actor changes
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications, complaints]);

  const activeResident = useMemo(() => {
    return residents.find((r) => r.id === activeResidentId) || null;
  }, [residents, activeResidentId]);

  const activeWorker = useMemo(() => {
    return workers.find((w) => w.id === activeWorkerId) || null;
  }, [workers, activeWorkerId]);

  const login = useCallback((role: RoleType, residentId?: string, workerId?: string) => {
    setIsAuthenticated(true);
    setCurrentRoleState(role);
    if (residentId !== undefined) setActiveResidentId(residentId);
    if (workerId !== undefined) setActiveWorkerId(workerId);

    const session: AuthSession = {
      role,
      residentId: residentId ?? (role === 'Resident' ? (residents.find((r) => r.active)?.id || null) : null),
      workerId: workerId ?? (role === 'Worker' ? (workers.find((w) => w.active)?.id || null) : null),
      authenticatedAt: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Failed to save auth session to sessionStorage', err);
    }
  }, [residents, workers]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setActiveResidentId(null);
    setActiveWorkerId(null);
    setNotifications([]);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to remove auth session from sessionStorage', err);
    }
    broadcastLogout();
  }, []);

  const setRole = useCallback((role: RoleType, residentId?: string, workerId?: string) => {
    setIsAuthenticated(true);
    setCurrentRoleState(role);
    if (residentId !== undefined) setActiveResidentId(residentId);
    if (workerId !== undefined) setActiveWorkerId(workerId);

    const prevSession = getStoredSession();
    const session: AuthSession = {
      role,
      residentId:
        residentId !== undefined
          ? residentId
          : role === 'Resident'
          ? activeResidentId || residents.find((r) => r.active)?.id || null
          : null,
      workerId:
        workerId !== undefined
          ? workerId
          : role === 'Worker'
          ? activeWorkerId || workers.find((w) => w.active)?.id || null
          : null,
      authenticatedAt: prevSession?.authenticatedAt || new Date().toISOString(),
    };
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Failed to update auth session in sessionStorage', err);
    }
  }, [activeResidentId, activeWorkerId, residents, workers]);

  const createResident = useCallback(async (displayName: string, block: string, flatNumber: string): Promise<Resident> => {
    const newResident: Resident = {
      id: crypto.randomUUID(),
      displayName: displayName.trim(),
      block,
      flatNumber: flatNumber.trim(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveResident(newResident);
    setActiveResidentId(newResident.id);
    await refreshAll();
    return newResident;
  }, [refreshAll]);

  const createWorker = useCallback(async (name: string, specialty: string, contactNumber?: string): Promise<Worker> => {
    const newWorker: Worker = {
      id: crypto.randomUUID(),
      name: name.trim(),
      specialty: specialty.trim(),
      contactNumber: contactNumber?.trim() || undefined,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveWorker(newWorker);
    setActiveWorkerId(newWorker.id);
    await refreshAll();
    return newWorker;
  }, [refreshAll]);

  const updateWorker = useCallback(async (worker: Worker): Promise<void> => {
    await repository.saveWorker({
      ...worker,
      updatedAt: new Date().toISOString(),
    });
    await refreshAll();
  }, [refreshAll]);

  const updateSettings = useCallback(async (newSettings: CommunitySettings): Promise<void> => {
    await repository.saveSettings({
      ...newSettings,
      updatedAt: new Date().toISOString(),
    });
    setSettings(newSettings);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    await repository.markNotificationRead(id);
    await refreshNotifications();
  }, [refreshNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    let recipientId: string | undefined = undefined;
    if (currentRole === 'Resident' && activeResidentId) recipientId = activeResidentId;
    if (currentRole === 'Worker' && activeWorkerId) recipientId = activeWorkerId;
    await repository.markAllNotificationsRead(currentRole, recipientId);
    await refreshNotifications();
  }, [currentRole, activeResidentId, activeWorkerId, refreshNotifications]);

  const resetPrototypeData = useCallback(async () => {
    await repository.resetAllData();
    logout();
    await refreshAll();
  }, [logout, refreshAll]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);

  return (
    <AppContext.Provider
      value={{
        settings,
        residents,
        workers,
        complaints,
        notifications,
        unreadNotificationCount,
        currentRole,
        activeResident,
        activeWorker,
        loading,
        isAuthenticated,
        login,
        logout,
        setRole,
        createResident,
        createWorker,
        updateWorker,
        updateSettings,
        refreshAll,
        markNotificationRead,
        markAllNotificationsRead,
        resetPrototypeData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
