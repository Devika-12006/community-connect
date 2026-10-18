import { repository } from '../db/repository';
import type { Contact, ComplaintCategory } from '../types';

export interface ContactCSVRow {
  name: string;
  role: string;
  department: string;
  phoneNumber: string;
  email?: string;
  categories: string; // comma-separated
  serviceAreas: string; // comma-separated
  verified?: string; // 'true' | 'false' | 'yes' | 'no'
  active?: string; // 'true' | 'false' | 'yes' | 'no'
  notes?: string;
}

export interface CSVImportResult {
  importedCount: number;
  skippedCount: number;
  errors: string[];
  contacts: Contact[];
}

export const contactService = {
  /**
   * Normalize phone number to standard E.164-like format (e.g. +919876543210)
   */
  normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '').trim();
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }
      return `+${cleaned}`;
    }
    return cleaned;
  },

  /**
   * Validate contact data
   */
  validateContact(contact: Partial<Contact>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!contact.name || contact.name.trim().length === 0) {
      errors.push('Name is required.');
    }
    if (!contact.organizationId || contact.organizationId.trim().length === 0) {
      errors.push('Organization ID is required.');
    }
    if (!contact.phoneNumber || contact.phoneNumber.trim().length < 7) {
      errors.push('A valid phone number is required (min 7 digits).');
    }
    if (!contact.role || contact.role.trim().length === 0) {
      errors.push('Role is required.');
    }
    if (!contact.categories || contact.categories.length === 0) {
      errors.push('At least one issue category must be assigned.');
    }
    return { valid: errors.length === 0, errors };
  },

  /**
   * Check for duplicate contacts within the same organization
   */
  async findDuplicate(
    organizationId: string,
    phoneNumber: string,
    excludeId?: string
  ): Promise<Contact | null> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    const contacts = await repository.getContacts(organizationId);
    const dup = contacts.find(
      (c) =>
        c.id !== excludeId &&
        this.normalizePhoneNumber(c.phoneNumber) === normalized
    );
    return dup || null;
  },

  /**
   * Get all contacts for an organization with optional filtering
   */
  async getContacts(
    organizationId: string,
    filters?: {
      category?: ComplaintCategory | 'All';
      serviceArea?: string;
      verifiedOnly?: boolean;
      activeOnly?: boolean;
      searchTerm?: string;
    }
  ): Promise<Contact[]> {
    const all = await repository.getContacts(organizationId);
    return all.filter((c) => {
      if (filters?.verifiedOnly && !c.verified) return false;
      if (filters?.activeOnly && !c.active) return false;
      if (
        filters?.category &&
        filters.category !== 'All' &&
        !c.categories.includes(filters.category)
      ) {
        return false;
      }
      if (
        filters?.serviceArea &&
        filters.serviceArea !== 'All' &&
        !c.serviceAreas.some((sa) =>
          sa.toLowerCase().includes(filters.serviceArea!.toLowerCase())
        )
      ) {
        return false;
      }
      if (filters?.searchTerm && filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase();
        const inName = c.name.toLowerCase().includes(query);
        const inPhone = c.phoneNumber.toLowerCase().includes(query);
        const inRole = c.role.toLowerCase().includes(query);
        const inDept = c.department.toLowerCase().includes(query);
        const inNotes = (c.notes || '').toLowerCase().includes(query);
        if (!inName && !inPhone && !inRole && !inDept && !inNotes) return false;
      }
      return true;
    });
  },

  /**
   * Save (create or update) contact with validation and duplicate prevention
   */
  async saveContact(contactData: Omit<Contact, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): Promise<Contact> {
    const normalizedPhone = this.normalizePhoneNumber(contactData.phoneNumber);
    const existingDup = await this.findDuplicate(
      contactData.organizationId,
      normalizedPhone,
      contactData.id
    );

    if (existingDup) {
      throw new Error(
        `Contact with phone number ${normalizedPhone} already exists in this organization (${existingDup.name} - ${existingDup.role}).`
      );
    }

    const now = new Date().toISOString();
    let contact: Contact;

    if (contactData.id) {
      const existing = await repository.getContact(contactData.id);
      contact = {
        ...existing,
        ...contactData,
        id: contactData.id,
        phoneNumber: normalizedPhone,
        updatedAt: now,
        createdAt: existing?.createdAt || now,
      };
    } else {
      contact = {
        ...contactData,
        id: `cont-${crypto.randomUUID().slice(0, 8)}`,
        phoneNumber: normalizedPhone,
        createdAt: now,
        updatedAt: now,
      };
    }

    const val = this.validateContact(contact);
    if (!val.valid) {
      throw new Error(val.errors.join(' '));
    }

    await repository.saveContact(contact);
    return contact;
  },

  /**
   * Toggle contact verification status
   */
  async toggleVerification(id: string, actorName: string): Promise<Contact> {
    const contact = await repository.getContact(id);
    if (!contact) throw new Error('Contact not found');
    contact.verified = !contact.verified;
    contact.updatedAt = new Date().toISOString();
    await repository.saveContact(contact);

    await repository.addAuditLog({
      id: crypto.randomUUID(),
      organizationId: contact.organizationId,
      actorId: 'manager',
      actorName,
      action: contact.verified ? 'VERIFY_CONTACT' : 'UNVERIFY_CONTACT',
      recordType: 'CONTACT',
      recordId: contact.id,
      details: { name: contact.name, verified: contact.verified },
      createdAt: new Date().toISOString(),
    });

    return contact;
  },

  /**
   * Toggle contact active status
   */
  async toggleActive(id: string, actorName: string): Promise<Contact> {
    const contact = await repository.getContact(id);
    if (!contact) throw new Error('Contact not found');
    contact.active = !contact.active;
    contact.updatedAt = new Date().toISOString();
    await repository.saveContact(contact);

    await repository.addAuditLog({
      id: crypto.randomUUID(),
      organizationId: contact.organizationId,
      actorId: 'manager',
      actorName,
      action: contact.active ? 'ACTIVATE_CONTACT' : 'DEACTIVATE_CONTACT',
      recordType: 'CONTACT',
      recordId: contact.id,
      details: { name: contact.name, active: contact.active },
      createdAt: new Date().toISOString(),
    });

    return contact;
  },

  /**
   * Parse CSV content into contacts and save them
   */
  async importFromCSV(
    organizationId: string,
    csvContent: string,
    importedBy: string
  ): Promise<CSVImportResult> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { importedCount: 0, skippedCount: 0, errors: ['CSV file is empty or missing headers.'], contacts: [] };
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

    const nameIdx = headers.indexOf('name');
    const roleIdx = headers.indexOf('role');
    const deptIdx = headers.indexOf('department');
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile'));
    const emailIdx = headers.indexOf('email');
    const catIdx = headers.findIndex((h) => h.includes('categor') || h.includes('specialt'));
    const areaIdx = headers.findIndex((h) => h.includes('area') || h.includes('location'));
    const verIdx = headers.indexOf('verified');
    const actIdx = headers.indexOf('active');
    const notesIdx = headers.indexOf('notes');

    if (nameIdx === -1 || phoneIdx === -1) {
      return {
        importedCount: 0,
        skippedCount: 0,
        errors: ['CSV must contain at least "name" and "phoneNumber" (or "phone") headers.'],
        contacts: [],
      };
    }

    const imported: Contact[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV column split handling quotes
      const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const cleanCols = cols.map((c) => c.trim().replace(/^"|"$/g, ''));

      const name = cleanCols[nameIdx] || '';
      const phone = cleanCols[phoneIdx] || '';
      if (!name || !phone) {
        skipped++;
        errors.push(`Row ${i + 1}: Skipped due to missing name or phone number.`);
        continue;
      }

      const role = (roleIdx !== -1 ? cleanCols[roleIdx] : 'Technician') || 'Technician';
      const department = (deptIdx !== -1 ? cleanCols[deptIdx] : 'General') || 'General';
      const email = emailIdx !== -1 ? cleanCols[emailIdx] : undefined;

      const rawCats = catIdx !== -1 && cleanCols[catIdx] ? cleanCols[catIdx] : 'Other';
      const categories = rawCats
        .split(/[,|;]/)
        .map((c) => c.trim() as ComplaintCategory)
        .filter(Boolean);

      const rawAreas = areaIdx !== -1 && cleanCols[areaIdx] ? cleanCols[areaIdx] : 'General';
      const serviceAreas = rawAreas
        .split(/[,|;]/)
        .map((a) => a.trim())
        .filter(Boolean);

      const verified = verIdx !== -1 ? /true|yes|1/i.test(cleanCols[verIdx]) : true;
      const active = actIdx !== -1 ? !/false|no|0/i.test(cleanCols[actIdx]) : true;
      const notes = notesIdx !== -1 ? cleanCols[notesIdx] : undefined;

      try {
        const saved = await this.saveContact({
          organizationId,
          name,
          role,
          department,
          phoneNumber: phone,
          email,
          categories: categories.length ? categories : ['Other'],
          serviceAreas: serviceAreas.length ? serviceAreas : ['General'],
          verified,
          active,
          notes,
        });
        imported.push(saved);
      } catch (err: any) {
        skipped++;
        errors.push(`Row ${i + 1} (${name}): ${err.message || 'Validation error'}`);
      }
    }

    if (imported.length > 0) {
      await repository.addAuditLog({
        id: crypto.randomUUID(),
        organizationId,
        actorId: 'manager',
        actorName: importedBy,
        action: 'IMPORT_CONTACTS_CSV',
        recordType: 'CONTACT',
        recordId: `${imported.length} contacts`,
        details: { count: imported.length, skipped },
        createdAt: new Date().toISOString(),
      });
    }

    return {
      importedCount: imported.length,
      skippedCount: skipped,
      errors,
      contacts: imported,
    };
  },

  /**
   * Export contacts to CSV string
   */
  exportToCSV(contacts: Contact[]): string {
    const headers = [
      'name',
      'role',
      'department',
      'phoneNumber',
      'email',
      'categories',
      'serviceAreas',
      'verified',
      'active',
      'notes',
    ];

    const rows = contacts.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.role || '').replace(/"/g, '""')}"`,
      `"${(c.department || '').replace(/"/g, '""')}"`,
      `"${(c.phoneNumber || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.categories || []).join(';')}"`,
      `"${(c.serviceAreas || []).join(';')}"`,
      c.verified ? 'true' : 'false',
      c.active ? 'true' : 'false',
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};
