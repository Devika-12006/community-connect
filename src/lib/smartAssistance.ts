import type { Complaint, ComplaintCategory, ComplaintPriority } from '../types';

interface CategoryMatch {
  category: ComplaintCategory;
  confidence: 'high' | 'medium';
  matchedKeywords: string[];
}

const CATEGORY_KEYWORDS: Record<ComplaintCategory, string[]> = {
  'Garbage': ['garbage', 'trash', 'waste', 'bin', 'dump', 'debris', 'litter', 'rubbish', 'dustbin', 'cleaning', 'sweep'],
  'Roads and Potholes': ['pothole', 'road', 'asphalt', 'tar', 'crack', 'speed breaker', 'pavement', 'paver', 'curb', 'driveway'],
  'Streetlights': ['streetlight', 'street light', 'lamp', 'dark', 'bulb', 'flickering', 'pole', 'pathway light', 'illumination'],
  'Drainage': ['drain', 'drainage', 'clog', 'sewage', 'gutter', 'overflow', 'manhole', 'stagnant', 'foul smell', 'storm drain'],
  'Water Leakage': ['water', 'pipe', 'leak', 'leakage', 'burst', 'tap', 'dripping', 'valve', 'seepage', 'tank', 'pipeline', 'sprinkler'],
  'Common-Area Electrical': ['electric', 'electrical', 'wire', 'spark', 'short circuit', 'meter', 'breaker', 'panel', 'switch', 'socket', 'generator', 'lift', 'elevator'],
  'Other': [],
};

/**
 * Transparent keyword-based category suggestion.
 * Note: Clearly labeled as a rule-based suggestion, not artificial intelligence.
 */
export function suggestCategory(title: string, description: string): CategoryMatch | null {
  const combinedText = `${title} ${description}`.toLowerCase();
  if (!combinedText.trim()) return null;

  let bestCategory: ComplaintCategory | null = null;
  let maxMatches = 0;
  let matchedWords: string[] = [];

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'Other') continue;
    const matches = keywords.filter((kw) => combinedText.includes(kw));
    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      bestCategory = cat as ComplaintCategory;
      matchedWords = matches;
    }
  }

  if (bestCategory && maxMatches > 0) {
    return {
      category: bestCategory,
      confidence: maxMatches >= 2 ? 'high' : 'medium',
      matchedKeywords: matchedWords,
    };
  }

  return null;
}

export interface DuplicateWarning {
  hasDuplicate: boolean;
  similarComplaint?: {
    id: string;
    reference: string;
    title: string;
    category: ComplaintCategory;
    block: string;
    status: string;
    createdAt: string;
  };
  reason?: string;
}

/**
 * Transparent duplicate detection across active (non-closed/non-rejected) complaints.
 */
export function checkPossibleDuplicate(
  newTitle: string,
  newCategory: ComplaintCategory,
  newBlock: string,
  existingComplaints: Complaint[]
): DuplicateWarning {
  const activeComplaints = existingComplaints.filter(
    (c) => c.status !== 'Closed' && c.status !== 'Rejected'
  );

  const cleanTitle = newTitle.toLowerCase().trim();
  const words = cleanTitle.split(/\s+/).filter((w) => w.length > 3);

  for (const complaint of activeComplaints) {
    const isSameCategory = complaint.category === newCategory;
    const isSameBlock = complaint.block.toLowerCase() === newBlock.toLowerCase();

    if (isSameCategory && isSameBlock) {
      const compTitleWords = complaint.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const sharedWords = words.filter((w) => compTitleWords.includes(w));

      if (sharedWords.length >= 1 || words.length === 0) {
        return {
          hasDuplicate: true,
          similarComplaint: {
            id: complaint.id,
            reference: complaint.reference,
            title: complaint.title,
            category: complaint.category,
            block: complaint.block,
            status: complaint.status,
            createdAt: complaint.createdAt,
          },
          reason: `A similar ${complaint.category} report (${complaint.reference}) in ${complaint.block} is currently ${complaint.status}.`,
        };
      }
    }
  }

  return { hasDuplicate: false };
}

/**
 * Transparent priority suggestion rules for managers.
 */
export function suggestPriority(
  category: ComplaintCategory,
  requestUrgentAttention?: boolean,
  description?: string
): { priority: ComplaintPriority; reason: string } {
  const text = (description || '').toLowerCase();

  if (requestUrgentAttention) {
    return {
      priority: 'Urgent',
      reason: 'Resident explicitly requested urgent attention during submission.',
    };
  }

  if (category === 'Common-Area Electrical') {
    if (text.includes('spark') || text.includes('fire') || text.includes('shock') || text.includes('exposed')) {
      return {
        priority: 'Urgent',
        reason: 'Potential electrical hazard detected from keywords (spark/shock/exposed wire).',
      };
    }
    return {
      priority: 'High',
      reason: 'Electrical issues in common areas present safety risks.',
    };
  }

  if (category === 'Water Leakage') {
    if (text.includes('burst') || text.includes('flooding') || text.includes('gushing')) {
      return {
        priority: 'Urgent',
        reason: 'Major water leakage / burst pipe may cause structural damage or flooding.',
      };
    }
    return {
      priority: 'Medium',
      reason: 'Water leakage should be repaired before water loss or seepage escalates.',
    };
  }

  if (category === 'Drainage') {
    if (text.includes('overflow') || text.includes('sewage') || text.includes('open manhole')) {
      return {
        priority: 'High',
        reason: 'Sewage overflow or open manholes pose immediate sanitation and safety risks.',
      };
    }
    return {
      priority: 'Medium',
      reason: 'Drainage blockage requires scheduled clearing.',
    };
  }

  if (category === 'Streetlights') {
    return {
      priority: 'Medium',
      reason: 'Pathway and street lighting impact evening security and visibility.',
    };
  }

  if (category === 'Roads and Potholes') {
    return {
      priority: 'Low',
      reason: 'Pavement or road defects are typically batched for periodic maintenance.',
    };
  }

  return {
    priority: 'Low',
    reason: 'Standard routine maintenance issue.',
  };
}
