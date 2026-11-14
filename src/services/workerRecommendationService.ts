import type { Worker, Complaint } from '../types';
import { repository } from '../db/repository';

export interface WorkerRecommendation {
  worker: Worker;
  matchScore: number; // 0 to 100
  reasons: string[];
  activeTaskCount: number;
  completedTaskCount: number;
  skillMatch: boolean;
  categoryMatch: boolean;
  recommendationTier: 'Top Match' | 'Recommended' | 'Available' | 'Overloaded';
}

export const workerRecommendationService = {
  /**
   * Evaluate and rank all active workers for a specific complaint
   */
  async getRecommendations(complaint: Complaint): Promise<WorkerRecommendation[]> {
    try {
      const [allWorkers, allComplaints] = await Promise.all([
        repository.getWorkers(),
        repository.getComplaints(),
      ]);

      const activeWorkers = allWorkers.filter((w) => w.active);
      const textToMatch = `${complaint.title} ${complaint.description} ${complaint.specificLocation}`.toLowerCase();

      const results: WorkerRecommendation[] = activeWorkers.map((worker) => {
        let score = 0;
        const reasons: string[] = [];

        // 1. Category alignment (Max 40 pts)
        const supportedCats = worker.supportedCategories || [];
        const isExactCategory =
          supportedCats.includes(complaint.category) ||
          worker.specialty.toLowerCase().includes(complaint.category.toLowerCase()) ||
          (complaint.category === 'Water Leakage' && worker.specialty.toLowerCase().includes('plumb')) ||
          (complaint.category === 'Common-Area Electrical' && worker.specialty.toLowerCase().includes('electr')) ||
          (complaint.category === 'Streetlights' && worker.specialty.toLowerCase().includes('electr')) ||
          (complaint.category === 'Drainage' && (worker.specialty.toLowerCase().includes('plumb') || worker.specialty.toLowerCase().includes('sanit')));

        let categoryMatch = false;
        if (isExactCategory) {
          score += 40;
          categoryMatch = true;
          reasons.push(`Primary specialty in ${complaint.category}`);
        } else if (worker.specialty.toLowerCase().includes('general') || worker.specialty.toLowerCase().includes('maintenance')) {
          score += 20;
          reasons.push('General maintenance capacity');
        }

        // 2. Specific technical skill match (Max 25 pts)
        const skills = worker.skills || [];
        let matchedSkillsCount = 0;
        for (const skill of skills) {
          const words = skill.toLowerCase().split(/\s+/);
          if (words.some((w) => w.length > 3 && textToMatch.includes(w))) {
            matchedSkillsCount++;
          }
        }

        let skillMatch = false;
        if (matchedSkillsCount > 0) {
          const skillPts = Math.min(25, matchedSkillsCount * 12);
          score += skillPts;
          skillMatch = true;
          reasons.push(`Specialized skill match (${matchedSkillsCount} technical keywords)`);
        }

        // 3. Workload evaluation (Max 25 pts)
        const activeTasks = allComplaints.filter(
          (c) =>
            c.assignedWorkerId === worker.id &&
            (c.status === 'Assigned' || c.status === 'In Progress' || c.status === 'Reopened')
        ).length;

        const completedTasks = allComplaints.filter(
          (c) =>
            c.assignedWorkerId === worker.id &&
            (c.status === 'Resolved' || c.status === 'Closed')
        ).length;

        if (activeTasks === 0) {
          score += 25;
          reasons.push('Immediately available (0 active tasks)');
        } else if (activeTasks === 1) {
          score += 20;
          reasons.push('Low workload (1 active task)');
        } else if (activeTasks === 2) {
          score += 15;
          reasons.push('Moderate workload (2 active tasks)');
        } else if (activeTasks >= 4) {
          score -= 10;
          reasons.push(`High workload (${activeTasks} concurrent tasks)`);
        }

        // 4. Past performance and track record (Max 10 pts)
        const rating = worker.averageRating || 4.5;
        if (rating >= 4.7 && completedTasks >= 5) {
          score += 10;
          reasons.push(`High resident satisfaction (${rating.toFixed(1)}/5 stars)`);
        } else if (completedTasks >= 3) {
          score += 5;
          reasons.push(`Demonstrated track record (${completedTasks} resolved issues)`);
        }

        const finalScore = Math.max(0, Math.min(100, score));

        let recommendationTier: 'Top Match' | 'Recommended' | 'Available' | 'Overloaded' = 'Available';
        if (finalScore >= 75) recommendationTier = 'Top Match';
        else if (finalScore >= 50) recommendationTier = 'Recommended';
        else if (activeTasks >= 4) recommendationTier = 'Overloaded';

        return {
          worker,
          matchScore: finalScore,
          reasons,
          activeTaskCount: activeTasks,
          completedTaskCount: completedTasks,
          skillMatch,
          categoryMatch,
          recommendationTier,
        };
      });

      // Sort by match score descending
      return results.sort((a, b) => b.matchScore - a.matchScore);
    } catch (err) {
      console.warn('Error computing worker recommendations:', err);
      return [];
    }
  },
};
