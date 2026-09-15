import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { repository } from '../db/repository';
import { subscribeToSync, initBroadcastSync } from '../db/broadcast';
import {
  DEFAULT_SETTINGS,
  type CommunitySettings,
  type Resident,
  type Worker,
  type Complaint,
  type Notification,
  type RoleType,
} from '../types';

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
  const [settings, setSettings] = useState<CommunitySettings>(DEFAULT_SETTINGS);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentRole, setCurrentRoleState] = useState<RoleType>('Resident');
  const [activeResidentId, setActiveResidentId] = useState<string | null>(null);
  const [activeWorkerId, setActiveWorkerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize broadcast channel for tab synchronization
  useEffect(() => {
    initBroadcastSync();
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

      // Preserve or set active resident
      setActiveResidentId((prev) => {
        if (prev && rList.some((r) => r.id === prev && r.active)) return prev;
        const firstActive = rList.find((r) => r.active);
        return firstActive ? firstActive.id : null;
      });

      // Preserve or set active worker
      setActiveWorkerId((prev) => {
        if (prev && wList.some((w) => w.id === prev && w.active)) return prev;
        const firstActive = wList.find((w) => w.active);
        return firstActive ? firstActive.id : null;
      });
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications for the current active role & actor
  const refreshNotifications = useCallback(async () => {
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
  }, [currentRole, activeResidentId, activeWorkerId]);

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

  const setRole = useCallback((role: RoleType, residentId?: string, workerId?: string) => {
    setCurrentRoleState(role);
    if (residentId !== undefined) setActiveResidentId(residentId);
    if (workerId !== undefined) setActiveWorkerId(workerId);
  }, []);

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
    setActiveResidentId(null);
    setActiveWorkerId(null);
    await refreshAll();
  }, [refreshAll]);

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
