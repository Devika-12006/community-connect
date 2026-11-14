import type { Complaint, ComplaintCategory, DuplicateMatch } from '../types';
import { repository } from '../db/repository';

export interface DuplicateCheckParams {
  title: string;
  description: string;
  category: ComplaintCategory;
  block: string;
  assetId?: string;
  currentComplaintId?: string;
  imageDHash?: string;
  lookbackDays?: number;
}

export const duplicateDetectionService = {
  /**
   * Compute token-based Jaccard similarity between two text strings
   */
  calculateJaccardSimilarity(textA: string, textB: string): number {
    const tokenize = (t: string) =>
      new Set(
        t
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2)
      );

    const setA = tokenize(textA);
    const setB = tokenize(textB);

    if (setA.size === 0 || setB.size === 0) return 0;

    let intersectionCount = 0;
    for (const item of setA) {
      if (setB.has(item)) intersectionCount++;
    }

    const unionCount = setA.size + setB.size - intersectionCount;
    return unionCount > 0 ? intersectionCount / unionCount : 0;
  },

  /**
   * Scan active complaints for potential duplicate issues
   */
  async scanForDuplicates(params: DuplicateCheckParams): Promise<DuplicateMatch | null> {
    try {
      const allComplaints = await repository.getComplaints();
      const lookbackMs = (params.lookbackDays || 30) * 24 * 60 * 60 * 1000;
      const cutoffTime = Date.now() - lookbackMs;

      // Filter to unresolved active complaints within window
      const activeCandidates = allComplaints.filter((c) => {
        if (params.currentComplaintId && c.id === params.currentComplaintId) return false;
        if (c.status === 'Closed' || c.status === 'Rejected') return false;
        const created = new Date(c.createdAt).getTime();
        return created >= cutoffTime;
      });

      let bestMatch: DuplicateMatch | null = null;
      let highestScore = 0;

      for (const candidate of activeCandidates) {
        const factors: string[] = [];
        let score = 0;

        // Factor 1: Same Asset ID (High weight: +40 pts)
        if (params.assetId && candidate.assetId && params.assetId === candidate.assetId) {
          score += 40;
          factors.push(`Linked to same community equipment (${candidate.assetCode || candidate.assetName || 'Asset'})`);
        }

        // Factor 2: Same Category (+20 pts)
        if (candidate.category === params.category) {
          score += 20;
          factors.push(`Same maintenance category (${candidate.category})`);
        }

        // Factor 3: Same Building/Block (+20 pts)
        if (candidate.block.toLowerCase().trim() === params.block.toLowerCase().trim()) {
          score += 20;
          factors.push(`Same building location (${candidate.block})`);
        }

        // Factor 4: Textual description & title similarity (+30 pts max)
        const combinedQuery = `${params.title} ${params.description}`;
        const combinedCandidate = `${candidate.title} ${candidate.description}`;
        const jaccard = this.calculateJaccardSimilarity(combinedQuery, combinedCandidate);

        if (jaccard >= 0.4) {
          const textScore = Math.round(jaccard * 30);
          score += textScore;
          factors.push(`High textual similarity (${Math.round(jaccard * 100)}% keyword overlap)`);
        } else if (jaccard >= 0.2) {
          score += 10;
          factors.push(`Moderate textual overlap (${Math.round(jaccard * 100)}% common keywords)`);
        }

        // Factor 5: Image Perceptual Duplicate match (+30 pts)
        if (params.imageDHash && candidate.originalImageIds && candidate.originalImageIds.length > 0) {
          // If candidate already has suspicious reuse flag with matching dHash
          if (candidate.suspiciousFlags?.some((f) => f.type === 'REUSED_PHOTO')) {
            score += 30;
            factors.push('Shares matching perceptual photograph fingerprint (dHash match)');
          }
        }

        // Threshold: Score >= 50 indicates likely duplicate
        if (score >= 50 && score > highestScore) {
          highestScore = score;
          bestMatch = {
            matchedComplaintId: candidate.id,
            matchedReference: candidate.reference,
            matchedTitle: candidate.title,
            category: candidate.category,
            block: candidate.block,
            similarityScore: Math.min(100, score),
            factors,
            status: 'Flagged',
          };
        }
      }

      return bestMatch;
    } catch (err) {
      console.warn('Error during duplicate scanning:', err);
      return null;
    }
  },

  /**
   * Manager actions on duplicate complaint
   */
  async handleManagerDuplicateDecision(
    complaintId: string,
    action: 'Confirm' | 'Link' | 'MarkSeparate' | 'Dismiss',
    primaryComplaintId?: string,
    managerName = 'Community Manager',
    notes?: string
  ): Promise<Complaint | null> {
    const complaint = await repository.getComplaint(complaintId);
    if (!complaint) return null;

    const now = new Date().toISOString();

    if (action === 'Confirm') {
      complaint.isDuplicate = true;
      complaint.duplicateStatus = 'Confirmed';
      complaint.duplicateOfId = primaryComplaintId || complaint.duplicateMatch?.matchedComplaintId;
      complaint.status = 'Closed'; // Marked closed as duplicate
      complaint.updatedAt = now;

      await repository.saveComplaint(complaint);
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId,
        eventType: 'Closed',
        action: 'Confirmed as Duplicate Ticket',
        actorRole: 'Manager',
        actorName: managerName,
        visibility: 'public',
        note: `Confirmed duplicate of ticket ${complaint.duplicateMatch?.matchedReference || primaryComplaintId}. ${notes || ''}`,
        createdAt: now,
      });
    } else if (action === 'Link') {
      complaint.duplicateStatus = 'Linked';
      complaint.duplicateOfId = primaryComplaintId || complaint.duplicateMatch?.matchedComplaintId;
      complaint.updatedAt = now;

      await repository.saveComplaint(complaint);
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId,
        eventType: 'InternalNote',
        action: 'Linked to Related Complaint',
        actorRole: 'Manager',
        actorName: managerName,
        visibility: 'internal',
        note: `Linked to related issue ${complaint.duplicateMatch?.matchedReference || primaryComplaintId}. Both will be tracked together. ${notes || ''}`,
        createdAt: now,
      });
    } else if (action === 'MarkSeparate') {
      complaint.isDuplicate = false;
      complaint.duplicateStatus = 'Dismissed';
      if (complaint.duplicateMatch) {
        complaint.duplicateMatch.status = 'Separate Issue';
      }
      complaint.updatedAt = now;

      await repository.saveComplaint(complaint);
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId,
        eventType: 'InternalNote',
        action: 'Marked as Separate Problem',
        actorRole: 'Manager',
        actorName: managerName,
        visibility: 'internal',
        note: `Manager verified this is a distinct issue from the flagged report. ${notes || ''}`,
        createdAt: now,
      });
    } else if (action === 'Dismiss') {
      complaint.duplicateStatus = 'Dismissed';
      if (complaint.duplicateMatch) {
        complaint.duplicateMatch.status = 'Dismissed';
      }
      complaint.updatedAt = now;

      await repository.saveComplaint(complaint);
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId,
        eventType: 'InternalNote',
        action: 'Duplicate Flag Dismissed',
        actorRole: 'Manager',
        actorName: managerName,
        visibility: 'internal',
        note: `Manager dismissed duplicate alert. ${notes || ''}`,
        createdAt: now,
      });
    }

    return complaint;
  },
};
