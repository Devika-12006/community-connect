import type { ComplaintPriority, PriorityAssessment, ComplaintCategory } from '../types';
import { repository } from '../db/repository';

export interface PriorityWeights {
  severity: number;
  affected: number;
  waiting: number;
  recurrence: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  severity: 7, // 7S
  affected: 5, // 5A
  waiting: 4,  // 4W
  recurrence: 4, // 4R
};

export const priorityEngine = {
  weights: DEFAULT_PRIORITY_WEIGHTS,

  /**
   * Dynamically calculate recurrence score R (0 to 5) based on database history.
   * Counts complaints on the same asset (or category in the same block/location)
   * within the lookback window (default 60 days).
   */
  async calculateRecurrenceScore(params: {
    assetId?: string;
    category?: ComplaintCategory;
    block?: string;
    lookbackDays?: number;
  }): Promise<number> {
    try {
      const allComplaints = await repository.getComplaints();
      const cutoffTime = Date.now() - (params.lookbackDays || 60) * 24 * 60 * 60 * 1000;

      const recentComplaints = allComplaints.filter((c) => {
        const createdTime = new Date(c.createdAt).getTime();
        if (createdTime < cutoffTime) return false;

        if (params.assetId && c.assetId === params.assetId) {
          return true;
        }

        if (params.category && params.block && c.category === params.category) {
          return c.block.toLowerCase() === params.block.toLowerCase();
        }

        return false;
      });

      const count = recentComplaints.length;

      // Scale 0-5 mapping
      if (count === 0) return 1; // Isolated / first occurrence
      if (count === 1) return 2; // Repeat issue
      if (count === 2) return 3; // Frequent fault
      if (count <= 4) return 4;  // Chronic issue
      return 5;                  // Systemic reliability hazard (5+ occurrences)
    } catch {
      return 1;
    }
  },

  /**
   * Determine priority tier from numeric score (0 to 100)
   * 0–29: Low, 30–49: Medium, 50–74: High, 75–100: Critical
   */
  getPriorityLevel(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 30) return 'Medium';
    return 'Low';
  },

  /**
   * Map priority level to UI ComplaintPriority
   */
  mapLevelToPriority(level: 'Low' | 'Medium' | 'High' | 'Critical'): ComplaintPriority {
    if (level === 'Critical') return 'Urgent';
    return level;
  },

  /**
   * Computes P = 7S + 5A + 4W + 4R
   * All parameters clamped to 0–5 (or 1–5 scale).
   * Maximum score = 7(5) + 5(5) + 4(5) + 4(5) = 35 + 25 + 20 + 20 = 100.
   */
  computePriority(params: {
    severity: number;      // S (0-5)
    affected: number;      // A (0-5)
    waitingTime?: number;  // W (0-5)
    recurrence?: number;   // R (0-5)
    assetName?: string;
  }): PriorityAssessment {
    const s = Math.max(0, Math.min(5, Math.round(params.severity)));
    const a = Math.max(0, Math.min(5, Math.round(params.affected)));
    const w = Math.max(0, Math.min(5, Math.round(params.waitingTime ?? 1)));
    const r = Math.max(0, Math.min(5, Math.round(params.recurrence ?? 1)));

    const safetyScore = this.weights.severity * s;
    const affectedScore = this.weights.affected * a;
    const waitingScore = this.weights.waiting * w;
    const recurrenceScore = this.weights.recurrence * r;

    const totalScore = Math.min(100, Math.max(0, safetyScore + affectedScore + waitingScore + recurrenceScore));
    const level = this.getPriorityLevel(totalScore);

    const severityDesc = [
      'Negligible',
      'Minor Cosmetic (1/5)',
      'Low Functional Impact (2/5)',
      'Moderate Inconvenience (3/5)',
      'Major Operational Disruption (4/5)',
      'Urgent Safety Hazard / Emergency (5/5)',
    ][s] || 'Standard';

    const affectedDesc = [
      'None',
      'Single Apartment / Flat (1/5)',
      'Corridor / Floor Wing (2/5)',
      'Entire Floor / Multiple Flats (3/5)',
      'Entire Building Block (4/5)',
      'Entire Gated Community (5/5)',
    ][a] || 'Standard';

    const waitingDesc = [
      'Just Reported (< 1 hr)',
      '< 12 hours pending',
      '12–24 hours pending',
      '24–48 hours overdue',
      '2–4 days overdue',
      '> 4 days critical delay',
    ][w] || 'Standard';

    const recurrenceDesc = [
      'First incident',
      'Isolated incident (0 prior)',
      'Repeat fault (1 prior)',
      'Frequent fault (2 prior)',
      'Chronic defect (3-4 prior)',
      'Systemic equipment hazard (5+ prior)',
    ][r] || 'Standard';

    const formula = `P = (7 × ${s}) + (5 × ${a}) + (4 × ${w}) + (4 × ${r}) = ${safetyScore} + ${affectedScore} + ${waitingScore} + ${recurrenceScore} = ${totalScore}/100`;

    const assetRef = params.assetName ? ` for asset "${params.assetName}"` : '';
    const explanation =
      `Calculated as ${level} Priority (${totalScore}/100)${assetRef}. ` +
      `Safety risk is evaluated as "${severityDesc}" (7×${s}=${safetyScore} pts), ` +
      `affecting "${affectedDesc}" (5×${a}=${affectedScore} pts), ` +
      `with waiting status "${waitingDesc}" (4×${w}=${waitingScore} pts), ` +
      `and historical recurrence "${recurrenceDesc}" (4×${r}=${recurrenceScore} pts).`;

    return {
      severity: s,
      affected: a,
      waitingTime: w,
      recurrence: r,
      score: totalScore,
      level,
      breakdown: {
        safetyScore,
        affectedScore,
        waitingScore,
        recurrenceScore,
      },
      formula,
      explanation,
    };
  },

  /**
   * Manager override for priority score with mandatory reason
   */
  overridePriority(
    original: PriorityAssessment,
    newLevel: 'Low' | 'Medium' | 'High' | 'Critical',
    overrideReason: string,
    overriddenBy: string
  ): PriorityAssessment {
    if (!overrideReason.trim()) {
      throw new Error('A mandatory justification reason is required to override priority score.');
    }

    const defaultScoreForLevel = {
      Low: 25,
      Medium: 40,
      High: 65,
      Critical: 85,
    }[newLevel];

    return {
      ...original,
      isOverridden: true,
      originalScore: original.score,
      originalLevel: original.level,
      score: defaultScoreForLevel,
      level: newLevel,
      overrideReason: overrideReason.trim(),
      overriddenBy: overriddenBy.trim(),
      overriddenAt: new Date().toISOString(),
      explanation: `${original.explanation} [OVERRIDDEN by ${overriddenBy}: Set to ${newLevel}. Reason: "${overrideReason.trim()}"]`,
    };
  },
};
