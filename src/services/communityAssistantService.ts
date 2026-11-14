import { repository } from '../db/repository';
import type { Resident } from '../types';

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  category?: string;
  sources?: string[];
  lastUpdated?: string;
  needsEscalation?: boolean;
  relatedComplaintReference?: string;
  suggestedQuickActions?: string[];
}

export const communityAssistantService = {
  /**
   * Process a natural language question from an authenticated resident
   */
  async processQuery(
    query: string,
    resident: Resident | null,
    _history: AssistantMessage[] = []
  ): Promise<AssistantMessage> {
    const rawQuery = query.trim();
    const lowerQuery = rawQuery.toLowerCase();
    const now = new Date().toISOString();

    // 1. Complaint Status & Tracking Lookup (Authenticated Resident Privacy Boundary)
    const isComplaintLookup =
      lowerQuery.includes('my complaint') ||
      lowerQuery.includes('status of') ||
      lowerQuery.includes('track') ||
      lowerQuery.includes('ticket') ||
      /cc-\d{4}-\d+/i.test(lowerQuery);

    if (isComplaintLookup) {
      if (!resident) {
        return {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: 'To protect resident privacy, personal complaint tracking is only available when you are signed in as a resident. Please sign in to view your complaint status.',
          timestamp: now,
          needsEscalation: false,
        };
      }

      const allComplaints = await repository.getComplaints();
      const residentComplaints = allComplaints.filter((c) => c.residentId === resident.id);

      // Check if query specifies a ticket reference
      const refMatch = rawQuery.match(/cc-\d{4}-\d+/i);
      if (refMatch) {
        const targetRef = refMatch[0].toUpperCase();
        const found = residentComplaints.find((c) => c.reference.toUpperCase() === targetRef);
        if (found) {
          const workerInfo = found.assignedWorkerName ? ` Assigned technician: ${found.assignedWorkerName}.` : ' Currently awaiting assignment by the manager.';
          return {
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: `Here is the status for your ticket **${found.reference}** ("${found.title}"):\n\n• **Status**: ${found.status}\n• **Priority**: ${found.priority}\n• **Category**: ${found.category}\n• **Location**: ${found.block}, ${found.specificLocation}\n• **Submitted**: ${new Date(found.createdAt).toLocaleDateString()}${workerInfo}\n\nWould you like to open the full ticket or add a note?`,
            timestamp: now,
            relatedComplaintReference: found.reference,
            sources: ['Live Database Complaint Registry'],
            suggestedQuickActions: ['View Complaint Details', 'Reopen Complaint', 'Report New Issue'],
          };
        } else {
          return {
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: `I checked your records, but could not find a complaint matching **${targetRef}** filed under your profile (${resident.displayName}). If this complaint was filed under another name or if you need assistance, would you like me to connect you with the Community Manager?`,
            timestamp: now,
            needsEscalation: true,
            sources: ['Resident Complaint Database'],
          };
        }
      }

      // No specific ref: show resident's active or recent complaints
      if (residentComplaints.length === 0) {
        return {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: `Hello ${resident.displayName}, you currently have no active or historical maintenance complaints filed for ${resident.block}, Flat ${resident.flatNumber}.\n\nIf you are experiencing an issue with water, electricity, lifts, or garbage, you can report an issue directly!`,
          timestamp: now,
          sources: ['Live Database Complaint Registry'],
          suggestedQuickActions: ['Report Issue', 'Water Supply Timings', 'Plumber Contact'],
        };
      }

      const activeComplaints = residentComplaints.filter((c) => c.status !== 'Closed' && c.status !== 'Rejected');
      if (activeComplaints.length > 0) {
        const listText = activeComplaints
          .map(
            (c) =>
              `• **${c.reference}**: "${c.title}" — *${c.status}* (${c.priority} Priority, ${c.assignedWorkerName || 'Awaiting Worker'})`
          )
          .join('\n');

        return {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: `Hello ${resident.displayName}, you have **${activeComplaints.length} active complaint(s)** in progress:\n\n${listText}\n\nYou can track updates, view technician notes, or review photos in the **My Complaints** section.`,
          timestamp: now,
          sources: ['Live Database Complaint Registry'],
          suggestedQuickActions: ['View My Complaints', 'Contact Manager'],
        };
      } else {
        const latest = residentComplaints[0];
        return {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: `All your previous complaints are resolved and closed. Your most recent ticket was **${latest.reference}** ("${latest.title}"), closed on ${new Date(latest.updatedAt).toLocaleDateString()}.\n\nDo you need to report a new problem?`,
          timestamp: now,
          sources: ['Live Database Complaint Registry'],
          suggestedQuickActions: ['Report Issue', 'Lift Contact', 'Garbage Schedule'],
        };
      }
    }

    // 2. Structured Knowledge Base Search (RAG)
    const knowledgeItems = await repository.getKnowledgeItems('ALL', true);

    // Scoring relevant knowledge items by token overlap
    const scoredItems = knowledgeItems.map((item) => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();
      const categoryLower = item.category.toLowerCase();

      // Category matching
      if (
        (lowerQuery.includes('water') && categoryLower.includes('water')) ||
        ((lowerQuery.includes('garbage') || lowerQuery.includes('trash') || lowerQuery.includes('waste')) && categoryLower.includes('garbage')) ||
        (lowerQuery.includes('lift') || lowerQuery.includes('elevator')) ||
        (lowerQuery.includes('electric') || lowerQuery.includes('spark') || lowerQuery.includes('wire')) ||
        (lowerQuery.includes('rule') || lowerQuery.includes('noise') || lowerQuery.includes('quiet') || lowerQuery.includes('pet')) ||
        (lowerQuery.includes('emergency') || lowerQuery.includes('police') || lowerQuery.includes('fire') || lowerQuery.includes('ambulance')) ||
        (lowerQuery.includes('office') || lowerQuery.includes('timing') || lowerQuery.includes('hour'))
      ) {
        score += 15;
      }

      // Query words match in title/content (excluding stop words)
      const STOP_WORDS = new Set([
        'the', 'what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that',
        'with', 'from', 'for', 'and', 'are', 'you', 'your', 'have', 'has', 'does',
        'did', 'can', 'could', 'should', 'would', 'about', 'how', 'any', 'all', 'our'
      ]);

      const words = lowerQuery
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

      for (const w of words) {
        if (titleLower.includes(w)) score += 8;
        if (contentLower.includes(w)) score += 3;
      }

      return { item, score };
    });

    scoredItems.sort((a, b) => b.score - a.score);
    // Strict threshold: score >= 15 ensures category or multiple primary keywords match
    const topMatch = scoredItems[0]?.score >= 15 ? scoredItems[0].item : null;

    if (topMatch) {
      let responseText = `**${topMatch.title}**\n\n${topMatch.content}`;

      // Append specific formatted guidance
      if (topMatch.category === 'Water Schedule') {
        responseText += `\n\n💡 *Tip: For emergency pipeline bursts or water tank overflows, please report an issue immediately or alert the security gate.*`;
      } else if (topMatch.category === 'Garbage Schedule') {
        responseText += `\n\n♻️ *Tip: Segregation of wet and dry waste is mandatory under Green Committee bylaws.*`;
      } else if (topMatch.category === 'Emergency Contact') {
        responseText += `\n\n🚨 *In case of lift entrapment, security officers at the Main Gate are notified automatically when you press the in-cabin alarm.*`;
      }

      return {
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: responseText,
        timestamp: now,
        category: topMatch.category,
        sources: [topMatch.sourceName || 'Community Knowledge Base'],
        lastUpdated: topMatch.lastUpdated,
        suggestedQuickActions: ['Report Issue', 'Contact Manager', 'Ask Another Question'],
      };
    }

    // 3. Fallback / Unanswered Query Handling
    return {
      id: crypto.randomUUID(),
      sender: 'assistant',
      text: `I'm sorry, I don't have verified information regarding "${rawQuery}" in our current community records.\n\nTo ensure accuracy, I do not make up schedules, contact numbers, or policies. Would you like me to forward this question to the **Community Manager** or provide the maintenance office contact?`,
      timestamp: now,
      needsEscalation: true,
      sources: ['Community Knowledge Base (No Exact Match)'],
      suggestedQuickActions: ['Contact Manager', 'Water Supply Timings', 'Garbage Collection Schedule', 'Emergency Contacts'],
    };
  },
};
