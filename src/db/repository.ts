import { getDatabase } from './database';
import { broadcastDataChange } from './broadcast';
import {
  DEFAULT_SETTINGS,
  DEFAULT_INTEGRATION_CONFIG,
  type CommunitySettings,
  type Resident,
  type Worker,
  type Complaint,
  type ComplaintEvent,
  type Notification,
  type ImageAsset,
  type Organization,
  type Contact,
  type AuthorizedGroupMessage,
  type ComplaintAssignmentRecord,
  type AuditLogEntry,
  type WhatsAppIntegrationConfig,
} from '../types';
import {
  SEED_ORGANIZATIONS,
  SEED_CONTACTS,
  SEED_GROUP_MESSAGES,
  SEED_INTEGRATION_CONFIG,
} from './agentSeedData';

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

  // --- AI Agent Seed Initialization ---
  async ensureSeedData(): Promise<void> {
    try {
      const db = await getDatabase();
      const orgs = await db.getAll('organizations');
      if (orgs.length === 0) {
        const tx = db.transaction(
          ['organizations', 'contacts', 'group_messages', 'integration_config'],
          'readwrite'
        );
        for (const org of SEED_ORGANIZATIONS) {
          await tx.objectStore('organizations').put(org);
        }
        for (const contact of SEED_CONTACTS) {
          await tx.objectStore('contacts').put(contact);
        }
        for (const msg of SEED_GROUP_MESSAGES) {
          await tx.objectStore('group_messages').put(msg);
        }
        await tx.objectStore('integration_config').put(SEED_INTEGRATION_CONFIG);
        await tx.done;
      }
    } catch (err) {
      console.error('Failed to ensure agent seed data:', err);
    }
  },

  // --- Organizations ---
  async getOrganizations(): Promise<Organization[]> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      const list = await db.getAll('organizations');
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  },

  async getOrganization(id: string): Promise<Organization | null> {
    try {
      const db = await getDatabase();
      const org = await db.get('organizations', id);
      return org || null;
    } catch {
      return null;
    }
  },

  async saveOrganization(org: Organization): Promise<void> {
    const db = await getDatabase();
    await db.put('organizations', org);
    broadcastDataChange('organizations', org.id);
  },

  // --- Contacts ---
  async getContacts(organizationId?: string): Promise<Contact[]> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      const list = organizationId
        ? await db.getAllFromIndex('contacts', 'by-org', organizationId)
        : await db.getAll('contacts');
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  },

  async getContact(id: string): Promise<Contact | null> {
    try {
      const db = await getDatabase();
      const c = await db.get('contacts', id);
      return c || null;
    } catch {
      return null;
    }
  },

  async saveContact(contact: Contact): Promise<void> {
    const db = await getDatabase();
    await db.put('contacts', contact);
    broadcastDataChange('contacts', contact.id);
  },

  async deleteContact(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('contacts', id);
    broadcastDataChange('contacts', id);
  },

  // --- Authorized Group Messages ---
  async getGroupMessages(organizationId?: string): Promise<AuthorizedGroupMessage[]> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      const list = organizationId
        ? await db.getAllFromIndex('group_messages', 'by-org', organizationId)
        : await db.getAll('group_messages');
      return list.sort(
        (a, b) =>
          new Date(b.messageTimestamp).getTime() - new Date(a.messageTimestamp).getTime()
      );
    } catch {
      return [];
    }
  },

  async getGroupMessage(id: string): Promise<AuthorizedGroupMessage | null> {
    try {
      const db = await getDatabase();
      const m = await db.get('group_messages', id);
      return m || null;
    } catch {
      return null;
    }
  },

  async saveGroupMessage(msg: AuthorizedGroupMessage): Promise<void> {
    const db = await getDatabase();
    await db.put('group_messages', msg);
    broadcastDataChange('group_messages', msg.id);
  },

  async deleteGroupMessage(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('group_messages', id);
    broadcastDataChange('group_messages', id);
  },

  // --- Assignments ---
  async getAssignments(complaintId?: string): Promise<ComplaintAssignmentRecord[]> {
    try {
      const db = await getDatabase();
      const list = complaintId
        ? await db.getAllFromIndex('assignments', 'by-complaint', complaintId)
        : await db.getAll('assignments');
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  },

  async saveAssignment(assignment: ComplaintAssignmentRecord): Promise<void> {
    const db = await getDatabase();
    await db.put('assignments', assignment);
    broadcastDataChange('assignments', assignment.id);
  },

  // --- Audit Logs ---
  async getAuditLogs(organizationId?: string): Promise<AuditLogEntry[]> {
    try {
      const db = await getDatabase();
      const list = organizationId
        ? await db.getAllFromIndex('audit_logs', 'by-org', organizationId)
        : await db.getAll('audit_logs');
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  },

  async addAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      const db = await getDatabase();
      await db.put('audit_logs', entry);
      broadcastDataChange('audit_logs', entry.id);
    } catch (err) {
      console.error('Error logging audit entry:', err);
    }
  },

  // --- Integration Config ---
  async getIntegrationConfig(): Promise<WhatsAppIntegrationConfig> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      const cfg = await db.get('integration_config', DEFAULT_INTEGRATION_CONFIG.id);
      if (!cfg) {
        await db.put('integration_config', DEFAULT_INTEGRATION_CONFIG);
        return DEFAULT_INTEGRATION_CONFIG;
      }
      return cfg;
    } catch {
      return DEFAULT_INTEGRATION_CONFIG;
    }
  },

  async saveIntegrationConfig(config: WhatsAppIntegrationConfig): Promise<void> {
    const db = await getDatabase();
    await db.put('integration_config', config);
    broadcastDataChange('integration_config', config.id);
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
      'organizations',
      'contacts',
      'group_messages',
      'assignments',
      'audit_logs',
      'integration_config',
    ] as const;
    const tx = db.transaction(stores, 'readwrite');
    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    // Re-seed default settings
    await tx.objectStore('settings').put(DEFAULT_SETTINGS);
    // Re-seed agent data
    for (const org of SEED_ORGANIZATIONS) {
      await tx.objectStore('organizations').put(org);
    }
    for (const contact of SEED_CONTACTS) {
      await tx.objectStore('contacts').put(contact);
    }
    for (const msg of SEED_GROUP_MESSAGES) {
      await tx.objectStore('group_messages').put(msg);
    }
    await tx.objectStore('integration_config').put(SEED_INTEGRATION_CONFIG);

    await tx.done;
    broadcastDataChange('all');
  },
};
