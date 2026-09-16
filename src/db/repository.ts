import { getDatabase } from './database';
import { broadcastDataChange } from './broadcast';
import {
  DEFAULT_SETTINGS,
  type CommunitySettings,
  type Resident,
  type Worker,
  type Complaint,
  type ComplaintEvent,
  type Notification,
  type ImageAsset,
} from '../types';

export const repository = {
  // --- Settings ---
  async getSettings(): Promise<CommunitySettings> {
    try {
      const db = await getDatabase();
      const settings = await db.get('settings', DEFAULT_SETTINGS.id);
      if (!settings) {
        await db.put('settings', DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      return settings;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: CommunitySettings): Promise<void> {
    const db = await getDatabase();
    await db.put('settings', settings);
    broadcastDataChange('settings', settings.id);
  },

  // --- Residents ---
  async getResidents(): Promise<Resident[]> {
    try {
      const db = await getDatabase();
      const list = await db.getAll('residents');
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async getResident(id: string): Promise<Resident | null> {
    try {
      const db = await getDatabase();
      const resident = await db.get('residents', id);
      return resident || null;
    } catch {
      return null;
    }
  },

  async saveResident(resident: Resident): Promise<void> {
    const db = await getDatabase();
    await db.put('residents', resident);
    broadcastDataChange('residents', resident.id);
  },

  // --- Workers ---
  async getWorkers(): Promise<Worker[]> {
    try {
      const db = await getDatabase();
      const list = await db.getAll('workers');
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  },

  async getWorker(id: string): Promise<Worker | null> {
    try {
      const db = await getDatabase();
      const worker = await db.get('workers', id);
      return worker || null;
    } catch {
      return null;
    }
  },

  async saveWorker(worker: Worker): Promise<void> {
    const db = await getDatabase();
    await db.put('workers', worker);
    broadcastDataChange('workers', worker.id);
  },

  // --- Complaints ---
  async getComplaints(): Promise<Complaint[]> {
    try {
      const db = await getDatabase();
      const list = await db.getAll('complaints');
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async getComplaint(id: string): Promise<Complaint | null> {
    try {
      const db = await getDatabase();
      const complaint = await db.get('complaints', id);
      return complaint || null;
    } catch {
      return null;
    }
  },

  async saveComplaint(complaint: Complaint): Promise<void> {
    const db = await getDatabase();
    await db.put('complaints', complaint);
    broadcastDataChange('complaints', complaint.id);
  },

  async getNextReference(): Promise<string> {
    const complaints = await this.getComplaints();
    const currentYear = new Date().getFullYear();
    const count = complaints.length + 1;
    return `CC-${currentYear}-${String(count).padStart(3, '0')}`;
  },

  // --- Events / Timeline ---
  async getEvents(complaintId: string): Promise<ComplaintEvent[]> {
    try {
      const db = await getDatabase();
      const events = await db.getAllFromIndex('events', 'by-complaint', complaintId);
      return events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async addEvent(event: ComplaintEvent): Promise<void> {
    const db = await getDatabase();
    await db.put('events', event);
    broadcastDataChange('events', event.complaintId);
  },

  // --- Notifications ---
  async getNotifications(role: string, recipientId?: string): Promise<Notification[]> {
    try {
      const db = await getDatabase();
      const all = await db.getAll('notifications');
      return all
        .filter((n) => {
          if (n.recipientRole !== role) return false;
          if (role === 'Manager') return true;
          return n.recipientId === recipientId || n.recipientId === 'ALL';
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async addNotification(notification: Notification): Promise<void> {
    try {
      const db = await getDatabase();
      if (notification.deduplicationKey) {
        const all = await db.getAll('notifications');
        const exists = all.some((n) => n.deduplicationKey === notification.deduplicationKey);
        if (exists) return;
      }
      await db.put('notifications', notification);
      broadcastDataChange('notifications', notification.id);
    } catch (err) {
      console.error('Error adding notification:', err);
    }
  },

  async markNotificationRead(id: string): Promise<void> {
    try {
      const db = await getDatabase();
      const notification = await db.get('notifications', id);
      if (notification && !notification.readAt) {
        notification.readAt = new Date().toISOString();
        await db.put('notifications', notification);
        broadcastDataChange('notifications', id);
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  },

  async markAllNotificationsRead(role: string, recipientId?: string): Promise<void> {
    try {
      const db = await getDatabase();
      const notifications = await this.getNotifications(role, recipientId);
      const now = new Date().toISOString();
      const tx = db.transaction('notifications', 'readwrite');
      for (const n of notifications) {
        if (!n.readAt) {
          n.readAt = now;
          await tx.store.put(n);
        }
      }
      await tx.done;
      broadcastDataChange('notifications');
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  },

  // --- Images (Blob Storage) ---
  async saveImage(image: ImageAsset): Promise<void> {
    const db = await getDatabase();
    await db.put('images', image);
  },

  async getImage(id: string): Promise<ImageAsset | null> {
    try {
      const db = await getDatabase();
      const img = await db.get('images', id);
      return img || null;
    } catch {
      return null;
    }
  },

  async getImages(ids: string[]): Promise<ImageAsset[]> {
    try {
      const db = await getDatabase();
      const images: ImageAsset[] = [];
      for (const id of ids) {
        const img = await db.get('images', id);
        if (img) images.push(img);
      }
      return images;
    } catch {
      return [];
    }
  },

  async getAllImages(): Promise<ImageAsset[]> {
    try {
      const db = await getDatabase();
      return await db.getAll('images');
    } catch {
      return [];
    }
  },

  async dismissSuspiciousFlags(complaintId: string, managerName: string, note?: string): Promise<Complaint | null> {
    const complaint = await this.getComplaint(complaintId);
    if (!complaint) return null;
    const now = new Date().toISOString();
    complaint.dismissedSuspiciousFlags = true;
    complaint.isSuspicious = false;
    complaint.updatedAt = now;
    await this.saveComplaint(complaint);

    await this.addEvent({
      id: crypto.randomUUID(),
      complaintId,
      eventType: 'FlagDismissed',
      action: 'Suspicious Flag Dismissed',
      actorRole: 'Manager',
      actorName: managerName,
      visibility: 'internal',
      note: note || 'Community manager reviewed and cleared verification flag.',
      createdAt: now,
    });

    return complaint;
  },

  // --- Reset All Data ---
  async resetAllData(): Promise<void> {
    const db = await getDatabase();
    const stores = [
      'settings',
      'residents',
      'workers',
      'complaints',
      'events',
      'notifications',
      'images',
    ] as const;
    const tx = db.transaction(stores, 'readwrite');
    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    // Re-seed default settings
    await tx.objectStore('settings').put(DEFAULT_SETTINGS);
    await tx.done;
    broadcastDataChange('all');
  },
};
