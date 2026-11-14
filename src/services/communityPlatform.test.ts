import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { priorityEngine } from './priorityEngine';
import { duplicateDetectionService } from './duplicateDetectionService';
import { workerRecommendationService } from './workerRecommendationService';
import { communityAssistantService } from './communityAssistantService';
import { authService } from './authService';
import { repository } from '../db/repository';
import type { Complaint, Resident } from '../types';

describe('Feature 3: Explainable Priority Scoring Engine', () => {
  it('correctly calculates P = 7S + 5A + 4W + 4R for the evaluator benchmark (S=4, A=3, W=2, R=4 -> 67/100 High)', () => {
    const result = priorityEngine.computePriority({
      severity: 4,
      affected: 3,
      waitingTime: 2,
      recurrence: 4,
      assetName: 'Passenger Lift A1',
    });

    // 7*4 + 5*3 + 4*2 + 4*4 = 28 + 15 + 8 + 16 = 67
    expect(result.score).toBe(67);
    expect(result.level).toBe('High');
    expect(result.breakdown.safetyScore).toBe(28);
    expect(result.breakdown.affectedScore).toBe(15);
    expect(result.breakdown.waitingScore).toBe(8);
    expect(result.breakdown.recurrenceScore).toBe(16);
    expect(result.formula).toContain('28 + 15 + 8 + 16 = 67/100');
    expect(result.explanation).toContain('High Priority (67/100)');
  });

  it('correctly calculates minimum (0/100 Low) and maximum (100/100 Critical) bounds', () => {
    const minResult = priorityEngine.computePriority({
      severity: 0,
      affected: 0,
      waitingTime: 0,
      recurrence: 0,
    });
    expect(minResult.score).toBe(0);
    expect(minResult.level).toBe('Low');

    const maxResult = priorityEngine.computePriority({
      severity: 5,
      affected: 5,
      waitingTime: 5,
      recurrence: 5,
    });
    // 7*5 + 5*5 + 4*5 + 4*5 = 35 + 25 + 20 + 20 = 100
    expect(maxResult.score).toBe(100);
    expect(maxResult.level).toBe('Critical');
  });

  it('allows manager priority override and enforces mandatory reason', () => {
    const original = priorityEngine.computePriority({
      severity: 2,
      affected: 2,
      waitingTime: 1,
      recurrence: 1,
    }); // 14 + 10 + 4 + 4 = 32 (Medium)

    expect(() => {
      priorityEngine.overridePriority(original, 'Critical', '   ', 'Rajesh Sharma');
    }).toThrow('mandatory justification reason is required');

    const overridden = priorityEngine.overridePriority(
      original,
      'Critical',
      'VIP visit and immediate physical hazard near daycare',
      'Rajesh Sharma'
    );
    expect(overridden.isOverridden).toBe(true);
    expect(overridden.level).toBe('Critical');
    expect(overridden.score).toBe(85);
    expect(overridden.overrideReason).toContain('VIP visit');
    expect(overridden.overriddenBy).toBe('Rajesh Sharma');
  });
});

describe('Feature 2: Smart Duplicate Complaint Detection', () => {
  beforeEach(async () => {
    await repository.ensureSeedData();
  });

  it('detects duplicate complaints when matching same asset and high text similarity', async () => {
    const existingComplaint: Complaint = {
      id: 'comp-dup-test-1',
      reference: 'CC-2026-0099',
      residentId: 'res-devika-1',
      residentName: 'Devika Sen',
      residentBlock: 'Block A',
      title: 'Elevator jerking between floors 4 and 5',
      description: 'Loud rattling noise and sudden leveling jerk in Passenger Lift A1',
      category: 'Common-Area Electrical',
      block: 'Block A',
      specificLocation: 'Block A Main Elevator Lobby',
      assetId: 'ast-elev-01',
      priority: 'High',
      status: 'Assigned',
      originalImageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveComplaint(existingComplaint);

    const duplicateCheck = await duplicateDetectionService.scanForDuplicates({
      title: 'Elevator sudden jerk between 4th and 5th floor',
      description: 'The lift has loud rattling noise and shakes when leveling',
      category: 'Common-Area Electrical',
      block: 'Block A',
      assetId: 'ast-elev-01',
    });

    expect(duplicateCheck).toBeTruthy();
    expect(duplicateCheck?.matchedComplaintId).toBe('comp-dup-test-1');
    expect(duplicateCheck?.similarityScore).toBeGreaterThanOrEqual(60);
    expect(duplicateCheck?.factors.some((f) => f.includes('same community equipment'))).toBe(true);
  });

  it('allows manager to confirm duplicate and marks ticket as closed', async () => {
    const primaryComplaint: Complaint = {
      id: 'comp-primary-1',
      reference: 'CC-2026-0001',
      residentId: 'res-devika-1',
      residentName: 'Devika Sen',
      residentBlock: 'Block A',
      title: 'Water pipe leaking in Basement',
      description: 'Dripping pipe near pump',
      category: 'Water Leakage',
      block: 'Block A',
      specificLocation: 'Basement 1',
      priority: 'Medium',
      status: 'In Progress',
      originalImageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveComplaint(primaryComplaint);

    const secondaryComplaint: Complaint = {
      id: 'comp-secondary-2',
      reference: 'CC-2026-0002',
      residentId: 'res-arjun-1',
      residentName: 'Arjun Verma',
      residentBlock: 'Block A',
      title: 'Water puddle in Basement from leaking pipe',
      description: 'Same leak reported earlier',
      category: 'Water Leakage',
      block: 'Block A',
      specificLocation: 'Basement 1',
      priority: 'Medium',
      status: 'Submitted',
      originalImageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveComplaint(secondaryComplaint);

    const updated = await duplicateDetectionService.handleManagerDuplicateDecision(
      'comp-secondary-2',
      'Confirm',
      'comp-primary-1',
      'Rajesh Sharma',
      'Verified same pipe leak in Basement 1'
    );

    expect(updated?.isDuplicate).toBe(true);
    expect(updated?.duplicateStatus).toBe('Confirmed');
    expect(updated?.duplicateOfId).toBe('comp-primary-1');
    expect(updated?.status).toBe('Closed');
  });
});

describe('Feature 5: Smart Worker Recommendation Engine', () => {
  it('ranks plumber top for water leakage with low workload', async () => {
    const complaint: Complaint = {
      id: 'comp-water-test',
      reference: 'CC-2026-0050',
      residentId: 'res-devika-1',
      residentName: 'Devika Sen',
      residentBlock: 'Block A',
      title: 'Water booster pump gushing water in basement',
      description: 'Major pipeline leak near valve replacement area',
      category: 'Water Leakage',
      block: 'Block A',
      specificLocation: 'Basement 1 Pump Room',
      priority: 'High',
      status: 'Submitted',
      originalImageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const recommendations = await workerRecommendationService.getRecommendations(complaint);
    expect(recommendations.length).toBeGreaterThan(0);

    const topMatch = recommendations[0];
    expect(topMatch.worker.name).toContain('Ramesh Kumar');
    expect(topMatch.categoryMatch).toBe(true);
    expect(topMatch.matchScore).toBeGreaterThanOrEqual(70);
  });
});

describe('Feature 8: AI Community Assistant', () => {
  const residentDevika: Resident = {
    id: 'res-devika-1',
    displayName: 'Devika Sen',
    block: 'Block A',
    flatNumber: '302',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('answers water supply schedule queries with verified timetable', async () => {
    const res = await communityAssistantService.processQuery(
      'When is water supply available in the morning?',
      residentDevika
    );
    expect(res.text).toContain('06:00 AM');
    expect(res.text).toContain('09:30 AM');
    expect(res.sources).toContain('Estate Management Water Division');
  });

  it('answers garbage collection schedule queries with door-to-door timings', async () => {
    const res = await communityAssistantService.processQuery(
      'What time does garbage collection happen for wet waste?',
      residentDevika
    );
    expect(res.text).toContain('07:30 AM');
    expect(res.text).toContain('09:00 AM');
  });

  it('provides 24/7 lift emergency hotline for entrapment queries', async () => {
    const res = await communityAssistantService.processQuery(
      'Who should I call for a lift breakdown or emergency entrapment?',
      residentDevika
    );
    expect(res.text).toContain('1800-120-3344');
    expect(res.text).toContain('Security');
  });

  it('retrieves only authenticated resident complaints and refuses unauthorized access when logged out', async () => {
    // When signed out
    const loggedOutRes = await communityAssistantService.processQuery(
      'What is the status of my complaint?',
      null
    );
    expect(loggedOutRes.text).toContain('privacy');

    // When signed in as Devika
    const signedInRes = await communityAssistantService.processQuery(
      'What is the status of my complaint?',
      residentDevika
    );
    expect(signedInRes.text).toContain('Devika Sen');
  });

  it('politely indicates when information is unavailable and offers manager escalation', async () => {
    const res = await communityAssistantService.processQuery(
      'What is the price of purchasing gold coins at the clubhouse?',
      residentDevika
    );
    expect(res.needsEscalation).toBe(true);
    expect(res.text).toContain("I don't have verified information");
    expect(res.text).toContain('Community Manager');
  });
});

describe('Authentication & Security Service', () => {
  it('hashes passwords consistently using SHA-256 with salt', async () => {
    const hash1 = await authService.hashPassword('Manager@123', 'test_salt_1');
    const hash2 = await authService.hashPassword('Manager@123', 'test_salt_1');
    const hash3 = await authService.hashPassword('Manager@123', 'different_salt');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('enforces password complexity validation rules', () => {
    expect(authService.validatePasswordStrength('short').valid).toBe(false);
    expect(authService.validatePasswordStrength('nouppercase123!').valid).toBe(false);
    expect(authService.validatePasswordStrength('NoSpecialChar123').valid).toBe(false);
    expect(authService.validatePasswordStrength('Valid@Pass123').valid).toBe(true);
  });

  it('authenticates pre-seeded manager credentials (manager / Manager@123)', async () => {
    await repository.ensureSeedData();
    const result = await authService.login('manager', 'Manager@123');
    expect(result.success).toBe(true);
    expect(result.role).toBe('Manager');
  });

  it('rejects incorrect passwords with security error', async () => {
    await repository.ensureSeedData();
    const result = await authService.login('manager', 'WrongPassword@123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid username or password');
  });
});
