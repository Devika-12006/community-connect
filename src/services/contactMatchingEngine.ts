import { repository } from '../db/repository';
import { groupMessageService } from './groupMessageService';
import type {
  Contact,
  ComplaintCategory,
  ContactMatchScore,
  AuthorizedGroupMessage,
  AIComplaintAnalysis,
} from '../types';

export interface MatchingResult {
  recommendedContact: Contact | null;
  matchScore: number;
  matchReason: string;
  supportingEvidence: string[];
  candidates: ContactMatchScore[];
  routingStatus: 'Auto-Routed' | 'Recommended' | 'Requires Review';
}

export const contactMatchingEngine = {
  /**
   * Calculate category score (max 40)
   */
  calculateCategoryScore(contact: Contact, category: ComplaintCategory): number {
    if (contact.categories.includes(category)) {
      return 40;
    }
    // Related categories
    if (
      (category === 'Streetlights' && contact.categories.includes('Common-Area Electrical')) ||
      (category === 'Common-Area Electrical' && contact.categories.includes('Streetlights')) ||
      (category === 'Water Leakage' && contact.categories.includes('Drainage')) ||
      (category === 'Drainage' && contact.categories.includes('Water Leakage'))
    ) {
      return 30;
    }
    if (contact.categories.includes('Other')) {
      return 10;
    }
    return 0;
  },

  /**
   * Calculate location / service area score (max 30)
   */
  calculateLocationScore(contact: Contact, location: string): number {
    if (!location || location === 'Location unspecified') {
      return 10; // Neutral baseline when location is unknown
    }

    const normLoc = location.toLowerCase();
    for (const area of contact.serviceAreas) {
      const normArea = area.toLowerCase();
      if (normLoc.includes(normArea) || normArea.includes(normLoc)) {
        return 30;
      }
      if (normArea === 'common grounds' && (normLoc.includes('park') || normLoc.includes('driveway') || normLoc.includes('gate'))) {
        return 28;
      }
    }

    // Fallback if contact serves all areas or estate-wide
    if (
      contact.serviceAreas.some((a) =>
        /all|entire|general|estate|ward/i.test(a)
      )
    ) {
      return 20;
    }

    return 0;
  },

  /**
   * Calculate role / responsibility score (max 20)
   */
  calculateRoleScore(contact: Contact, category: ComplaintCategory): number {
    const roleAndDept = `${contact.role} ${contact.department}`.toLowerCase();

    switch (category) {
      case 'Streetlights':
      case 'Common-Area Electrical':
        if (roleAndDept.includes('electric') || roleAndDept.includes('power') || roleAndDept.includes('lighting')) {
          return 20;
        }
        break;
      case 'Water Leakage':
        if (roleAndDept.includes('plumb') || roleAndDept.includes('water') || roleAndDept.includes('pipeline')) {
          return 20;
        }
        break;
      case 'Drainage':
        if (roleAndDept.includes('drain') || roleAndDept.includes('sewage') || roleAndDept.includes('sanitation') || roleAndDept.includes('plumb')) {
          return 20;
        }
        break;
      case 'Garbage':
        if (roleAndDept.includes('sanitation') || roleAndDept.includes('housekeeping') || roleAndDept.includes('waste') || roleAndDept.includes('clean')) {
          return 20;
        }
        break;
      case 'Roads and Potholes':
        if (roleAndDept.includes('civil') || roleAndDept.includes('road') || roleAndDept.includes('works') || roleAndDept.includes('infrastructure')) {
          return 20;
        }
        break;
      default:
        if (roleAndDept.includes('maintenance') || roleAndDept.includes('supervisor') || roleAndDept.includes('engineer')) {
          return 15;
        }
    }

    if (roleAndDept.includes('handyman') || roleAndDept.includes('technician') || roleAndDept.includes('maintenance')) {
      return 10;
    }

    return 0;
  },

  /**
   * Calculate evidence score from authorized group messages (max 10)
   */
  calculateEvidenceScore(
    contact: Contact,
    category: ComplaintCategory,
    location: string,
    evidenceMessages: AuthorizedGroupMessage[]
  ): { score: number; citedEvidence: string[] } {
    let score = 0;
    const citedEvidence: string[] = [];
    const contactNameLower = contact.name.toLowerCase();
    const contactPhoneLower = contact.phoneNumber.replace(/[^\d]/g, '');

    for (const msg of evidenceMessages) {
      const msgTextLower = msg.messageText.toLowerCase();
      const mentionsContact =
        msgTextLower.includes(contactNameLower) ||
        (contactPhoneLower.length >= 6 && msgTextLower.includes(contactPhoneLower));

      if (mentionsContact) {
        score = 10;
        citedEvidence.push(
          `Official notice "${msg.sourceName}" explicitly references ${contact.name}: "${msg.messageText.slice(0, 80)}..."`
        );
        break;
      } else if (msg.categoryTag === category && (!msg.locationTag || location.toLowerCase().includes(msg.locationTag.toLowerCase()))) {
        score = Math.max(score, 6);
        citedEvidence.push(
          `Recent authorized update "${msg.sourceName}" notes active ${category} maintenance in ${msg.locationTag || location}.`
        );
      }
    }

    return { score, citedEvidence };
  },

  /**
   * Find and rank contacts for a complaint
   */
  async matchContact(
    organizationId: string,
    analysis: AIComplaintAnalysis
  ): Promise<MatchingResult> {
    const config = await repository.getIntegrationConfig();
    const minConfidence = config.minimumConfidenceThreshold || 40;
    const autoRoutingThreshold = config.autoRoutingThreshold || 70;

    // 1. Fetch contacts for this organization ONLY
    const allContacts = await repository.getContacts(organizationId);

    // 2. Strict Filter: MUST be verified and active
    const candidateContacts = allContacts.filter(
      (c) => c.verified === true && c.active === true
    );

    if (candidateContacts.length === 0) {
      return {
        recommendedContact: null,
        matchScore: 0,
        matchReason: 'No verified and active contacts found for this organization.',
        supportingEvidence: [],
        candidates: [],
        routingStatus: 'Requires Review',
      };
    }

    // 3. Retrieve relevant authorized group message evidence
    const relevantEvidence = await groupMessageService.findRelevantEvidence(
      organizationId,
      analysis.category,
      analysis.location,
      analysis.extractedKeywords || analysis.keywords
    );

    // 4. Score each candidate
    const scoredCandidates: ContactMatchScore[] = candidateContacts.map((contact) => {
      const categoryScore = this.calculateCategoryScore(contact, analysis.category);
      const locationScore = this.calculateLocationScore(contact, analysis.location);
      const roleScore = this.calculateRoleScore(contact, analysis.category);
      const { score: evidenceScore, citedEvidence } = this.calculateEvidenceScore(
        contact,
        analysis.category,
        analysis.location,
        relevantEvidence
      );

      const totalScore = categoryScore + locationScore + roleScore + evidenceScore;

      // Build explanation
      const reasonParts: string[] = [];
      reasonParts.push(`${contact.name} (${contact.role}, ${contact.department}) scored ${totalScore}% overall.`);
      if (categoryScore >= 30) reasonParts.push(`Category match: ${categoryScore}/40 for ${analysis.category}.`);
      if (locationScore >= 20) reasonParts.push(`Service area match: ${locationScore}/30 covering ${analysis.location}.`);
      if (roleScore >= 15) reasonParts.push(`Role relevance: ${roleScore}/20.`);
      if (evidenceScore > 0) reasonParts.push(`Group notice evidence: ${evidenceScore}/10.`);

      const fullReason = reasonParts.join(' ');

      return {
        contact,
        contactId: contact.id,
        contactName: contact.name,
        contactRole: contact.role,
        department: contact.department,
        totalScore,
        breakdown: {
          categoryScore,
          locationScore,
          roleScore,
          evidenceScore,
          categoryMatch: categoryScore,
          locationMatch: locationScore,
          roleResponsibilityMatch: roleScore,
          messageEvidenceMatch: evidenceScore,
        },
        explanation: fullReason,
        reason: fullReason,
        supportingEvidence: citedEvidence,
        supportingMessages: relevantEvidence,
      };
    });

    // 5. Sort candidates descending by total score
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    const topCandidateScore = scoredCandidates[0];
    const topCandidate = topCandidateScore?.contact || candidateContacts.find((c) => c.id === topCandidateScore?.contactId) || null;

    // 6. Check thresholds
    let routingStatus: 'Auto-Routed' | 'Recommended' | 'Requires Review';
    if (!topCandidate || topCandidateScore.totalScore < minConfidence) {
      routingStatus = 'Requires Review';
    } else if (config.autoRoutingEnabled && topCandidateScore.totalScore >= autoRoutingThreshold) {
      routingStatus = 'Auto-Routed';
    } else {
      routingStatus = 'Recommended';
    }

    const matchReason = topCandidate
      ? `${topCandidateScore.reason || topCandidateScore.explanation} ${(topCandidateScore.supportingEvidence || []).join(' ')}`
      : 'Insufficient match confidence. Routed to community manager review.';

    return {
      recommendedContact: topCandidate,
      matchScore: topCandidateScore ? topCandidateScore.totalScore : 0,
      matchReason: matchReason.trim(),
      supportingEvidence: topCandidateScore ? topCandidateScore.supportingEvidence || [] : [],
      candidates: scoredCandidates.slice(0, 5),
      routingStatus,
    };
  },
};
