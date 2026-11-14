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
  type Asset,
  type CommunityKnowledgeItem,
  type UserAccount,
} from '../types';
import {
  SEED_ORGANIZATIONS,
  SEED_CONTACTS,
  SEED_GROUP_MESSAGES,
  SEED_INTEGRATION_CONFIG,
  SEED_ASSETS,
  SEED_KNOWLEDGE_BASE,
  SEED_USER_ACCOUNTS,
} from './agentSeedData';

export const SEED_RESIDENTS: Resident[] = [
  {
    id: 'res-devika-1',
    displayName: 'Devika Sen',
    block: 'Block A',
    flatNumber: '302',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'res-arjun-1',
    displayName: 'Arjun Verma',
    block: 'Block B',
    flatNumber: '501',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'res-priya-1',
    displayName: 'Priya Nair',
    block: 'Block A',
    flatNumber: '104',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

export const SEED_WORKERS: Worker[] = [
  {
    id: 'worker-plumber-1',
    name: 'Ramesh Kumar',
    specialty: 'Plumbing & Water Systems',
    contactNumber: '+919876543212',
    skills: ['Pipeline Welding', 'Booster Pump Overhaul', 'Valve Replacement', 'Drainage Clearing'],
    supportedCategories: ['Water Leakage', 'Drainage'],
    completedTasksCount: 14,
    activeWorkload: 1,
    averageRating: 4.8,
    availabilityStatus: 'Available',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'worker-elec-1',
    name: 'Suresh Patel',
    specialty: 'Electrical Maintenance',
    contactNumber: '+919876543210',
    skills: ['High Voltage Wiring', 'Circuit Breakers', 'Streetlight Repairs', 'Generator Servicing'],
    supportedCategories: ['Streetlights', 'Common-Area Electrical'],
    completedTasksCount: 19,
    activeWorkload: 2,
    averageRating: 4.9,
    availabilityStatus: 'Available',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'worker-elev-1',
    name: 'Vikram Singh',
    specialty: 'Elevator & Lift Maintenance',
    contactNumber: '+919876543214',
    skills: ['Traction Cable Inspection', 'Door Sensor Alignment', 'Governor Calibration', 'Emergency Braking'],
    supportedCategories: ['Common-Area Electrical'],
    completedTasksCount: 11,
    activeWorkload: 1,
    averageRating: 4.7,
    availabilityStatus: 'Available',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

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

  // --- AI Agent & Platform Seed Initialization ---
  async ensureSeedData(): Promise<void> {
    try {
      const db = await getDatabase();
      const [orgs, users, assets, know, residents, workers] = await Promise.all([
        db.getAll('organizations'),
        db.getAll('user_accounts'),
        db.getAll('assets'),
        db.getAll('knowledge_base'),
        db.getAll('residents'),
        db.getAll('workers'),
      ]);

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

      if (assets.length === 0) {
        const tx = db.transaction('assets', 'readwrite');
        for (const asset of SEED_ASSETS) {
          await tx.objectStore('assets').put(asset);
        }
        await tx.done;
      }

      if (know.length === 0) {
        const tx = db.transaction('knowledge_base', 'readwrite');
        for (const item of SEED_KNOWLEDGE_BASE) {
          await tx.objectStore('knowledge_base').put(item);
        }
        await tx.done;
      }

      if (users.length === 0) {
        const tx = db.transaction('user_accounts', 'readwrite');
        for (const user of SEED_USER_ACCOUNTS) {
          await tx.objectStore('user_accounts').put(user);
        }
        await tx.done;
      }

      if (residents.length === 0) {
        const tx = db.transaction('residents', 'readwrite');
        for (const res of SEED_RESIDENTS) {
          await tx.objectStore('residents').put(res);
        }
        await tx.done;
      }

      if (workers.length === 0) {
        const tx = db.transaction('workers', 'readwrite');
        for (const wrk of SEED_WORKERS) {
          await tx.objectStore('workers').put(wrk);
        }
        await tx.done;
      }
    } catch (err) {
      console.error('Failed to ensure platform seed data:', err);
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

  // --- Assets (Manual Selection Only - Strictly No QR) ---
  async getAssets(filter?: {
    category?: string;
    building?: string;
    activeOnly?: boolean;
    search?: string;
  }): Promise<Asset[]> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      let list = await db.getAll('assets');
      if (filter?.activeOnly !== false) {
        list = list.filter((a) => a.active);
      }
      if (filter?.category && filter.category !== 'ALL') {
        list = list.filter((a) => a.category === filter.category);
      }
      if (filter?.building && filter.building !== 'ALL') {
        list = list.filter((a) => a.building.toLowerCase() === filter.building?.toLowerCase());
      }
      if (filter?.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        list = list.filter(
          (a) =>
            a.assetCode.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.location.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
        );
      }
      return list.sort((a, b) => a.assetCode.localeCompare(b.assetCode));
    } catch {
      return [];
    }
  },

  async getAsset(id: string): Promise<Asset | null> {
    try {
      const db = await getDatabase();
      const asset = await db.get('assets', id);
      return asset || null;
    } catch {
      return null;
    }
  },

  async getAssetByCode(code: string): Promise<Asset | null> {
    try {
      const db = await getDatabase();
      const asset = await db.getFromIndex('assets', 'by-code', code.trim().toUpperCase());
      return asset || null;
    } catch {
      return null;
    }
  },

  async saveAsset(asset: Asset): Promise<void> {
    const db = await getDatabase();
    await db.put('assets', asset);
    broadcastDataChange('assets', asset.id);
  },

  async deleteAsset(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('assets', id);
    broadcastDataChange('assets', id);
  },

  // --- Community Knowledge Base (AI Assistant RAG Store) ---
  async getKnowledgeItems(category?: string, activeOnly = true): Promise<CommunityKnowledgeItem[]> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      let list = await db.getAll('knowledge_base');
      if (activeOnly) {
        list = list.filter((item) => item.active);
      }
      if (category && category !== 'ALL') {
        list = list.filter((item) => item.category === category);
      }
      return list.sort((a, b) => a.title.localeCompare(b.title));
    } catch {
      return [];
    }
  },

  async getKnowledgeItem(id: string): Promise<CommunityKnowledgeItem | null> {
    try {
      const db = await getDatabase();
      const item = await db.get('knowledge_base', id);
      return item || null;
    } catch {
      return null;
    }
  },

  async saveKnowledgeItem(item: CommunityKnowledgeItem): Promise<void> {
    const db = await getDatabase();
    await db.put('knowledge_base', item);
    broadcastDataChange('knowledge_base', item.id);
  },

  async deleteKnowledgeItem(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('knowledge_base', id);
    broadcastDataChange('knowledge_base', id);
  },

  // --- User Accounts (Authentication & Credentials) ---
  async getUserAccounts(): Promise<UserAccount[]> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      return await db.getAll('user_accounts');
    } catch {
      return [];
    }
  },

  async getUserByUsername(username: string): Promise<UserAccount | null> {
    await this.ensureSeedData();
    try {
      const db = await getDatabase();
      const user = await db.getFromIndex('user_accounts', 'by-username', username.trim().toLowerCase());
      return user || null;
    } catch {
      return null;
    }
  },

  async saveUserAccount(user: UserAccount): Promise<void> {
    const db = await getDatabase();
    await db.put('user_accounts', {
      ...user,
      username: user.username.trim().toLowerCase(),
    });
    broadcastDataChange('user_accounts', user.id);
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
      'assets',
      'knowledge_base',
      'user_accounts',
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

    for (const asset of SEED_ASSETS) {
      await tx.objectStore('assets').put(asset);
    }
    for (const item of SEED_KNOWLEDGE_BASE) {
      await tx.objectStore('knowledge_base').put(item);
    }
    for (const user of SEED_USER_ACCOUNTS) {
      await tx.objectStore('user_accounts').put(user);
    }
    for (const resident of SEED_RESIDENTS) {
      await tx.objectStore('residents').put(resident);
    }
    for (const worker of SEED_WORKERS) {
      await tx.objectStore('workers').put(worker);
    }

    await tx.done;
    broadcastDataChange('all');
  },
};
