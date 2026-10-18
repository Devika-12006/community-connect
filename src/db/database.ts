import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  CommunitySettings,
  Resident,
  Worker,
  Complaint,
  ComplaintEvent,
  Notification,
  ImageAsset,
} from '../types';

export interface CommunityConnectDB extends DBSchema {
  settings: {
    key: string;
    value: CommunitySettings;
  };
  residents: {
    key: string;
    value: Resident;
    indexes: { 'by-block': string };
  };
  workers: {
    key: string;
    value: Worker;
    indexes: { 'by-active': number };
  };
  complaints: {
    key: string;
    value: Complaint;
    indexes: {
      'by-resident': string;
      'by-worker': string;
      'by-status': string;
      'by-category': string;
      'by-created': string;
    };
  };
  events: {
    key: string;
    value: ComplaintEvent;
    indexes: { 'by-complaint': string };
  };
  notifications: {
    key: string;
    value: Notification;
    indexes: {
      'by-recipient': string;
      'by-role': string;
      'by-dedup': string;
    };
  };
  images: {
    key: string;
    value: ImageAsset;
    indexes: { 'by-complaint': string };
  };
  organizations: {
    key: string;
    value: import('../types').Organization;
    indexes: { 'by-active': number };
  };
  contacts: {
    key: string;
    value: import('../types').Contact;
    indexes: {
      'by-org': string;
      'by-verified': number;
      'by-active': number;
      'by-department': string;
    };
  };
  group_messages: {
    key: string;
    value: import('../types').AuthorizedGroupMessage;
    indexes: {
      'by-org': string;
      'by-permission': string;
      'by-timestamp': string;
    };
  };
  assignments: {
    key: string;
    value: import('../types').ComplaintAssignmentRecord;
    indexes: {
      'by-complaint': string;
      'by-contact': string;
      'by-org': string;
    };
  };
  audit_logs: {
    key: string;
    value: import('../types').AuditLogEntry;
    indexes: {
      'by-org': string;
      'by-action': string;
      'by-record': string;
    };
  };
  integration_config: {
    key: string;
    value: import('../types').WhatsAppIntegrationConfig;
  };
}

const DB_NAME = 'community_connect_v2_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<CommunityConnectDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<CommunityConnectDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CommunityConnectDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('residents')) {
          const store = db.createObjectStore('residents', { keyPath: 'id' });
          store.createIndex('by-block', 'block');
        }

        if (!db.objectStoreNames.contains('workers')) {
          const store = db.createObjectStore('workers', { keyPath: 'id' });
          store.createIndex('by-active', 'active');
        }

        if (!db.objectStoreNames.contains('complaints')) {
          const store = db.createObjectStore('complaints', { keyPath: 'id' });
          store.createIndex('by-resident', 'residentId');
          store.createIndex('by-worker', 'assignedWorkerId');
          store.createIndex('by-status', 'status');
          store.createIndex('by-category', 'category');
          store.createIndex('by-created', 'createdAt');
        }

        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('by-complaint', 'complaintId');
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const store = db.createObjectStore('notifications', { keyPath: 'id' });
          store.createIndex('by-recipient', 'recipientId');
          store.createIndex('by-role', 'recipientRole');
          store.createIndex('by-dedup', 'deduplicationKey');
        }

        if (!db.objectStoreNames.contains('images')) {
          const store = db.createObjectStore('images', { keyPath: 'id' });
          store.createIndex('by-complaint', 'complaintId');
        }

        // --- New stores for AI Complaint Routing Agent ---
        if (!db.objectStoreNames.contains('organizations')) {
          const store = db.createObjectStore('organizations', { keyPath: 'id' });
          store.createIndex('by-active', 'active');
        }

        if (!db.objectStoreNames.contains('contacts')) {
          const store = db.createObjectStore('contacts', { keyPath: 'id' });
          store.createIndex('by-org', 'organizationId');
          store.createIndex('by-verified', 'verified');
          store.createIndex('by-active', 'active');
          store.createIndex('by-department', 'department');
        }

        if (!db.objectStoreNames.contains('group_messages')) {
          const store = db.createObjectStore('group_messages', { keyPath: 'id' });
          store.createIndex('by-org', 'organizationId');
          store.createIndex('by-permission', 'permissionStatus');
          store.createIndex('by-timestamp', 'messageTimestamp');
        }

        if (!db.objectStoreNames.contains('assignments')) {
          const store = db.createObjectStore('assignments', { keyPath: 'id' });
          store.createIndex('by-complaint', 'complaintId');
          store.createIndex('by-contact', 'contactId');
          store.createIndex('by-org', 'organizationId');
        }

        if (!db.objectStoreNames.contains('audit_logs')) {
          const store = db.createObjectStore('audit_logs', { keyPath: 'id' });
          store.createIndex('by-org', 'organizationId');
          store.createIndex('by-action', 'action');
          store.createIndex('by-record', 'recordId');
        }

        if (!db.objectStoreNames.contains('integration_config')) {
          db.createObjectStore('integration_config', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}
