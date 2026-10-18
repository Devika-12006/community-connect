import { repository } from '../db/repository';
import type { AuthorizedGroupMessage, ComplaintCategory } from '../types';

export interface GroupMessageImportResult {
  importedCount: number;
  skippedCount: number;
  errors: string[];
  messages: AuthorizedGroupMessage[];
}

export const groupMessageService = {
  /**
   * Validate authorized group message
   */
  validateMessage(msg: Partial<AuthorizedGroupMessage>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!msg.organizationId) {
      errors.push('Organization ID is required.');
    }
    if (!msg.sourceName || msg.sourceName.trim().length === 0) {
      errors.push('Source name is required (e.g. Official RWA Broadcast).');
    }
    if (!msg.messageText || msg.messageText.trim().length === 0) {
      errors.push('Message text is required.');
    }
    if (msg.permissionStatus !== 'Authorized') {
      errors.push('Only Authorized messages with explicit consent can be imported.');
    }
    return { valid: errors.length === 0, errors };
  },

  /**
   * Get authorized group messages for an organization with optional filtering
   */
  async getMessages(
    organizationId: string,
    filters?: {
      category?: ComplaintCategory | 'All';
      location?: string;
      searchTerm?: string;
      permissionOnly?: boolean;
    }
  ): Promise<AuthorizedGroupMessage[]> {
    const all = await repository.getGroupMessages(organizationId);
    return all.filter((m) => {
      if (filters?.permissionOnly !== false && m.permissionStatus !== 'Authorized') {
        return false;
      }
      if (
        filters?.category &&
        filters.category !== 'All' &&
        m.categoryTag !== filters.category
      ) {
        return false;
      }
      if (
        filters?.location &&
        filters.location !== 'All' &&
        m.locationTag &&
        !m.locationTag.toLowerCase().includes(filters.location.toLowerCase())
      ) {
        return false;
      }
      if (filters?.searchTerm && filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase();
        const inText = m.messageText.toLowerCase().includes(query);
        const inSource = m.sourceName.toLowerCase().includes(query);
        const inCategory = (m.categoryTag || '').toLowerCase().includes(query);
        const inLocation = (m.locationTag || '').toLowerCase().includes(query);
        if (!inText && !inSource && !inCategory && !inLocation) return false;
      }
      return true;
    });
  },

  /**
   * Search authorized group messages specifically for AI routing evidence
   */
  async findRelevantEvidence(
    organizationId: string,
    category: ComplaintCategory,
    location?: string,
    keywords?: string[]
  ): Promise<AuthorizedGroupMessage[]> {
    const messages = await this.getMessages(organizationId, { permissionOnly: true });

    return messages
      .map((m) => {
        let relevanceScore = 0;
        const lowerText = m.messageText.toLowerCase();

        // Category match
        if (m.categoryTag === category) {
          relevanceScore += 5;
        } else if (lowerText.includes(category.toLowerCase())) {
          relevanceScore += 3;
        }

        // Location match
        if (location && location.trim().length > 1) {
          const locLower = location.toLowerCase();
          if (m.locationTag && m.locationTag.toLowerCase().includes(locLower)) {
            relevanceScore += 4;
          } else if (lowerText.includes(locLower)) {
            relevanceScore += 3;
          }
        }

        // Keyword matches
        if (keywords && keywords.length > 0) {
          for (const kw of keywords) {
            if (kw.length > 2 && lowerText.includes(kw.toLowerCase())) {
              relevanceScore += 1;
            }
          }
        }

        return { message: m, relevanceScore };
      })
      .filter((item) => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3)
      .map((item) => item.message);
  },

  /**
   * Save a single authorized group message
   */
  async saveMessage(
    data: Omit<AuthorizedGroupMessage, 'createdAt' | 'id'> & { id?: string }
  ): Promise<AuthorizedGroupMessage> {
    const now = new Date().toISOString();
    const message: AuthorizedGroupMessage = {
      ...data,
      id: data.id || `msg-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      messageTimestamp: data.messageTimestamp || now,
    };

    const val = this.validateMessage(message);
    if (!val.valid) {
      throw new Error(val.errors.join(' '));
    }

    await repository.saveGroupMessage(message);
    return message;
  },

  /**
   * Delete an authorized group message
   */
  async deleteMessage(id: string, actorName: string, organizationId: string): Promise<void> {
    await repository.deleteGroupMessage(id);
    await repository.addAuditLog({
      id: crypto.randomUUID(),
      organizationId,
      actorId: 'manager',
      actorName,
      action: 'DELETE_GROUP_MESSAGE',
      recordType: 'GROUP_MESSAGE',
      recordId: id,
      details: { id },
      createdAt: new Date().toISOString(),
    });
  },

  /**
   * Import authorized group messages from CSV
   */
  async importFromCSV(
    organizationId: string,
    csvContent: string,
    importedBy: string
  ): Promise<GroupMessageImportResult> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { importedCount: 0, skippedCount: 0, errors: ['CSV file is empty or missing headers.'], messages: [] };
    }

    const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const sourceNameIdx = headers.findIndex((h) => h.includes('source_name') || h.includes('sourcename') || h === 'source');
    const sourceTypeIdx = headers.findIndex((h) => h.includes('type'));
    const textIdx = headers.findIndex((h) => h.includes('message') || h.includes('text') || h.includes('content'));
    const timeIdx = headers.findIndex((h) => h.includes('time') || h.includes('date'));
    const permIdx = headers.findIndex((h) => h.includes('permission') || h.includes('consent') || h.includes('status'));
    const catIdx = headers.findIndex((h) => h.includes('category') || h.includes('tag'));
    const locIdx = headers.findIndex((h) => h.includes('location') || h.includes('area'));

    if (textIdx === -1) {
      return {
        importedCount: 0,
        skippedCount: 0,
        errors: ['CSV must contain a message text column.'],
        messages: [],
      };
    }

    const imported: AuthorizedGroupMessage[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const cleanCols = cols.map((c) => c.trim().replace(/^"|"$/g, ''));

      const text = cleanCols[textIdx] || '';
      if (!text) {
        skipped++;
        errors.push(`Row ${i + 1}: Skipped due to empty message text.`);
        continue;
      }

      const sourceName = (sourceNameIdx !== -1 ? cleanCols[sourceNameIdx] : 'Authorized Community Noticeboard') || 'Authorized Community Noticeboard';
      const sourceType = (sourceTypeIdx !== -1 ? cleanCols[sourceTypeIdx] : 'Exported CSV') || 'Exported CSV';
      const messageTimestamp = (timeIdx !== -1 && cleanCols[timeIdx]) ? cleanCols[timeIdx] : new Date().toISOString();
      const rawPerm = (permIdx !== -1 ? cleanCols[permIdx] : 'Authorized') || 'Authorized';
      const isExplicitlyUnauthorized = /unauthor|denied|revoked|no|false|reject/i.test(rawPerm);
      const isAuthorized = !isExplicitlyUnauthorized && /^(authorized|yes|true|permitted|consented)$/i.test(rawPerm.trim());

      if (!isAuthorized) {
        skipped++;
        errors.push(`Row ${i + 1}: Skipped because permission status is "${rawPerm}" (requires "Authorized").`);
        continue;
      }

      const categoryTag = (catIdx !== -1 && cleanCols[catIdx]) ? (cleanCols[catIdx] as ComplaintCategory) : undefined;
      const locationTag = (locIdx !== -1 && cleanCols[locIdx]) ? cleanCols[locIdx] : undefined;

      try {
        const saved = await this.saveMessage({
          organizationId,
          sourceName,
          sourceType,
          messageText: text,
          messageTimestamp,
          permissionStatus: 'Authorized',
          importedBy,
          categoryTag,
          locationTag,
        });
        imported.push(saved);
      } catch (err: any) {
        skipped++;
        errors.push(`Row ${i + 1}: ${err.message || 'Validation error'}`);
      }
    }

    if (imported.length > 0) {
      await repository.addAuditLog({
        id: crypto.randomUUID(),
        organizationId,
        actorId: 'manager',
        actorName: importedBy,
        action: 'IMPORT_GROUP_MESSAGES_CSV',
        recordType: 'GROUP_MESSAGE',
        recordId: `${imported.length} messages`,
        details: { count: imported.length, skipped },
        createdAt: new Date().toISOString(),
      });
    }

    return {
      importedCount: imported.length,
      skippedCount: skipped,
      errors,
      messages: imported,
    };
  },

  /**
   * Export authorized group messages to CSV
   */
  exportToCSV(messages: AuthorizedGroupMessage[]): string {
    const headers = [
      'sourceName',
      'sourceType',
      'messageText',
      'messageTimestamp',
      'permissionStatus',
      'importedBy',
      'categoryTag',
      'locationTag',
    ];

    const rows = messages.map((m) => [
      `"${(m.sourceName || '').replace(/"/g, '""')}"`,
      `"${(m.sourceType || '').replace(/"/g, '""')}"`,
      `"${(m.messageText || '').replace(/"/g, '""')}"`,
      `"${m.messageTimestamp || ''}"`,
      `"${m.permissionStatus || 'Authorized'}"`,
      `"${(m.importedBy || '').replace(/"/g, '""')}"`,
      `"${(m.categoryTag || '').replace(/"/g, '""')}"`,
      `"${(m.locationTag || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};
